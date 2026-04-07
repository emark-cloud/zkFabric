/**
 * zkFabric attestor
 * -----------------
 * A small backend service that turns Reclaim Protocol zkTLS proofs into
 * `ZKTLSAdapter`-compatible signed attestations. The frontend hands us a
 * Reclaim proof (generated via the Reclaim mobile / web SDK), we verify it
 * server-side, extract the claim into 8 credential slots, and return an ECDSA
 * signature over `keccak256(abi.encodePacked(user, identityCommitment, attestationData))`
 * that matches the signature shape `ZKTLSAdapter.submitAttestation` expects:
 *
 *   bytes32 messageHash = keccak256(abi.encodePacked(user, identityCommitment, attestationData));
 *   bytes32 ethSigned   = messageHash.toEthSignedMessageHash();
 *   require(ethSigned.recover(signature) == attestor);
 *
 * Reclaim verification is imported dynamically so the service still boots
 * (with ATTESTOR_DEV_MODE=1) when the SDK isn't installed yet — the dev mode
 * path is clearly logged and MUST NOT be used in production.
 *
 * Environment:
 *   ATTESTOR_PRIVATE_KEY   hex-encoded secp256k1 key the adapter trusts
 *   ATTESTOR_DEV_MODE      "1" to skip Reclaim verification (local demos only)
 *   PORT                   default 8788
 *   RECLAIM_APP_ID         Reclaim application identifier (required in prod)
 *   RECLAIM_APP_SECRET     Reclaim application secret (required in prod)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = Number(process.env.PORT ?? 8788);
const DEV_MODE = process.env.ATTESTOR_DEV_MODE === "1";
const ATTESTOR_PRIVATE_KEY = (process.env.ATTESTOR_PRIVATE_KEY ?? "") as Hex;
const RECLAIM_APP_ID = process.env.RECLAIM_APP_ID ?? "";
const RECLAIM_APP_SECRET = process.env.RECLAIM_APP_SECRET ?? "";

if (!ATTESTOR_PRIVATE_KEY || !ATTESTOR_PRIVATE_KEY.startsWith("0x")) {
  console.error("[attestor] ATTESTOR_PRIVATE_KEY missing or malformed (expected 0x-prefixed hex)");
  process.exit(1);
}

const account = privateKeyToAccount(ATTESTOR_PRIVATE_KEY);
console.log(`[attestor] signing address: ${account.address}`);
if (DEV_MODE) {
  console.warn("[attestor] *** DEV MODE — Reclaim proof verification is DISABLED ***");
}

// ----------------------------------------------------------------------------
// Reclaim verification
// ----------------------------------------------------------------------------

interface ReclaimProof {
  identifier: string;
  claimData: {
    provider: string;
    parameters: string;
    owner: string;
    timestampS: number;
    context: string;
    epoch: number;
  };
  signatures: string[];
  witnesses: Array<{ id: string; url: string }>;
}

async function verifyReclaimProof(proof: ReclaimProof): Promise<boolean> {
  if (DEV_MODE) {
    console.warn(`[attestor] DEV MODE: accepting proof ${proof.identifier} without verification`);
    return true;
  }
  if (!RECLAIM_APP_ID || !RECLAIM_APP_SECRET) {
    throw new Error("attestor: RECLAIM_APP_ID / RECLAIM_APP_SECRET must be set in production");
  }
  // Dynamic import so the service still boots if the SDK is not yet installed.
  try {
    const mod: any = await import("@reclaimprotocol/js-sdk");
    const verifyFn = mod.verifyProof ?? mod.default?.verifyProof;
    if (typeof verifyFn !== "function") {
      throw new Error("attestor: @reclaimprotocol/js-sdk does not export verifyProof");
    }
    const ok = await verifyFn(proof);
    return Boolean(ok);
  } catch (err) {
    console.error("[attestor] Reclaim verification failed:", err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Slot packing — mirrors sdk/src/adapters/ZKTLSIngester.ts
// ----------------------------------------------------------------------------

interface AttestationRequest {
  user: `0x${string}`;
  identityCommitment: string;
  provider: string;
  primaryAttribute: string;
  jurisdictionCode?: string;
  auxiliaryData1?: string;
  auxiliaryData2?: string;
  reclaimProof?: ReclaimProof;
}

function packSlots(req: AttestationRequest): bigint[] {
  const CREDENTIAL_TYPE_ZKTLS = 2n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  return [
    CREDENTIAL_TYPE_ZKTLS,
    BigInt(req.primaryAttribute),
    1n, // isActive
    now,
    BigInt(req.jurisdictionCode ?? "0"),
    BigInt(keccak256(encodePacked(["address"], [account.address]))) &
      ((1n << 128n) - 1n),
    BigInt(req.auxiliaryData1 ?? "0"),
    BigInt(req.auxiliaryData2 ?? "0"),
  ];
}

// ----------------------------------------------------------------------------
// Signing — must match ZKTLSAdapter.submitAttestation
// ----------------------------------------------------------------------------

async function signAttestation(
  user: `0x${string}`,
  identityCommitment: bigint,
  attestationData: `0x${string}`
) {
  // messageHash = keccak256(abi.encodePacked(user, identityCommitment, attestationData))
  const messageHash = keccak256(
    encodePacked(
      ["address", "uint256", "bytes"],
      [user, identityCommitment, attestationData]
    )
  );
  // Adapter applies toEthSignedMessageHash(), so we sign the raw bytes of the
  // 32-byte messageHash (viem's signMessage with { raw } prepends the EIP-191
  // prefix — exactly what the contract expects).
  const signature = await account.signMessage({
    message: { raw: messageHash },
  });
  return { messageHash, signature };
}

// ----------------------------------------------------------------------------
// HTTP API
// ----------------------------------------------------------------------------

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) =>
  c.json({
    ok: true,
    attestor: account.address,
    devMode: DEV_MODE,
    reclaimConfigured: Boolean(RECLAIM_APP_ID && RECLAIM_APP_SECRET),
  })
);

app.post("/attest", async (c) => {
  let body: AttestationRequest;
  try {
    body = (await c.req.json()) as AttestationRequest;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  if (!body.user || !body.identityCommitment || !body.provider || body.primaryAttribute === undefined) {
    return c.json({ error: "missing required fields (user, identityCommitment, provider, primaryAttribute)" }, 400);
  }

  // 1) Verify the Reclaim proof (skipped in dev mode).
  if (!DEV_MODE) {
    if (!body.reclaimProof) {
      return c.json({ error: "reclaimProof required in production mode" }, 400);
    }
    const ok = await verifyReclaimProof(body.reclaimProof);
    if (!ok) return c.json({ error: "reclaim proof verification failed" }, 400);
  }

  // 2) Pack claim into 8 credential slots.
  const slots = packSlots(body);

  // 3) Encode attestationData as the adapter expects (abi-encoded slot array
  //    alongside provider + timestamp for replay protection).
  const attestationData = encodeAbiParameters(
    [
      { name: "provider", type: "string" },
      { name: "slots", type: "uint256[8]" },
      { name: "timestamp", type: "uint256" },
    ],
    [
      body.provider,
      [slots[0], slots[1], slots[2], slots[3], slots[4], slots[5], slots[6], slots[7]],
      slots[3],
    ]
  );

  // 4) Sign `keccak256(abi.encodePacked(user, identityCommitment, attestationData))`.
  const { messageHash, signature } = await signAttestation(
    body.user,
    BigInt(body.identityCommitment),
    attestationData
  );

  return c.json({
    attestor: account.address,
    slots: slots.map((s) => s.toString()),
    attestationData,
    messageHash,
    signature,
  });
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[attestor] HTTP listening on http://0.0.0.0:${info.port}`);
});
