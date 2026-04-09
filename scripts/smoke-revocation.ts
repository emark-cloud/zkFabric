/**
 * smoke-revocation.ts — Live testnet smoke test for W1 root revocation.
 *
 * Flow:
 *   1. Generate a fresh identity + credential.
 *   2. Issue via KYCSBTAdapter.ingestAndRegister.
 *   3. Build a single-leaf IMT and call Registry.updateRoot.
 *   4. Generate a Groth16 proof (scope A) and call ZKFabricVerifier.verifyAndRecord
 *      → expect SUCCESS.
 *   5. Call RevocationRegistry.revokeRoot(root).
 *   6. Generate a second proof against the same root with a different scope
 *      (so the nullifier is fresh) and call verifyAndRecord
 *      → expect REVERT with "ZKFabricVerifier: root revoked".
 *
 * Usage:
 *   npx hardhat run scripts/smoke-revocation.ts --network hashkeyTestnet
 *
 * Reads addresses from app/src/lib/contracts.ts via hardcoded constants below
 * (kept in sync with that file).
 */
import { ethers } from "hardhat";
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import path from "path";

const snarkjs = require("snarkjs");

const ADDR = {
  registry: "0xa1708C934175Bf7EaC25220D560BE0C681725957",
  verifier: "0xd49cA44645E21076dcd83F285D23c99AbeB6D299",
  revocation: "0x735680A32A0e5d9d23D7e8e8302F434e7F30428E",
  kycSBT: "0x335C915Fa62eeBF9804a4398bb85Cd370B333850",
  kycAdapter: "0x3AfBFC76f49A4D466D03775B371a4F6142c6A194",
};

const TREE_DEPTH = 20;
const NUM_SLOTS = 8;
const SET_SIZE = 4;
const BN128 = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const BUILD = path.join(__dirname, "../circuits/build");
const WASM = path.join(BUILD, "selective_disclosure_js/selective_disclosure.wasm");
const ZKEY = path.join(BUILD, "selective_disclosure_final.zkey");

function scopeOf(label: string): bigint {
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(label))) % BN128;
}

async function buildProof(
  privateKey: bigint,
  slots: bigint[],
  tree: IMT,
  scope: bigint
) {
  const merkleProof = tree.createProof(0);
  const nullifierHash = poseidon2([privateKey, scope]);
  const predicateTypes = [1, 2, 1, 0, 0, 0, 0, 0];
  const predicateValues = [1n, 3n, 1n, 0n, 0n, 0n, 0n, 0n];
  const predicateSets: string[][] = Array.from({ length: NUM_SLOTS }, () =>
    new Array(SET_SIZE).fill("0")
  );
  const input = {
    privateKey: privateKey.toString(),
    credentialData: slots.map(String),
    merkleSiblings: merkleProof.siblings.map((s: any) =>
      (Array.isArray(s) ? s[0] : s).toString()
    ),
    merklePathIndices: merkleProof.pathIndices.map(String),
    merkleRoot: BigInt(tree.root).toString(),
    nullifierHash: nullifierHash.toString(),
    scope: scope.toString(),
    predicateTypes: predicateTypes.map(String),
    predicateValues: predicateValues.map(String),
    predicateSets,
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  const proofArray = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];
  return { proofArray, publicSignals: publicSignals.map(BigInt), nullifierHash };
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("signer:", signer.address);

  const registry = await ethers.getContractAt("ZKFabricRegistry", ADDR.registry);
  const verifier = await ethers.getContractAt("ZKFabricVerifier", ADDR.verifier);
  const revocation = await ethers.getContractAt("RevocationRegistry", ADDR.revocation);
  const adapter = await ethers.getContractAt("KYCSBTAdapter", ADDR.kycAdapter);
  const mockKyc = await ethers.getContractAt("MockKycSBT", ADDR.kycSBT);

  // Sanity: confirm verifier is wired to this revocation registry.
  const wiredRev = await verifier.revocationRegistry();
  console.log("verifier.revocationRegistry:", wiredRev);
  if (wiredRev.toLowerCase() !== ADDR.revocation.toLowerCase()) {
    throw new Error("verifier not wired to expected RevocationRegistry");
  }

  // 1. Identity (random, not 0 / not the deterministic demo key).
  const privateKey = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
  const identityCommitment = poseidon1([privateKey]);
  console.log("identityCommitment:", identityCommitment.toString().slice(0, 24), "...");

  // 2. Ensure KYC is APPROVED for signer.
  const [, lvl, st] = await mockKyc.getKycInfo(signer.address);
  if (Number(st) === 1 && Number(lvl) >= 3) {
    console.log(`KYC already set: level=${lvl} status=${st}`);
  } else {
    const tx0 = await mockKyc.setKycInfo(signer.address, "smoke.hsk", 3, 1);
    await tx0.wait();
    console.log("set KYC: PREMIUM/APPROVED");
  }

  // 3. Build slots and credential hash.
  const slots = [
    1n,
    3n,
    1n,
    BigInt(Math.floor(Date.now() / 1000)),
    344n,
    1n,
    0n,
    0n,
  ];
  const credentialHash = poseidon9([identityCommitment, ...slots]);
  console.log("credentialHash:", credentialHash.toString().slice(0, 24), "...");

  // 4. Issue via adapter. The deployed adapter at this address may predate W7's
  //    ingestAndRegister convenience method, so use the two-step path that exists
  //    in every version: ingestCredential then registerComputedCredential.
  const tx1a = await adapter.ingestCredential(signer.address, identityCommitment);
  await tx1a.wait();
  const tx1b = await adapter.registerComputedCredential(identityCommitment, credentialHash);
  await tx1b.wait();
  console.log("ingestCredential + registerComputedCredential: ok");

  // 5. Single-leaf tree and updateRoot.
  const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
  tree.insert(credentialHash);
  const root = BigInt(tree.root);
  console.log("tree root:", root.toString().slice(0, 24), "...");

  const tx2 = await registry.updateRoot(root);
  await tx2.wait();
  console.log("updateRoot: ok");
  if (!(await registry.isValidRoot(root))) throw new Error("root not valid after updateRoot");

  // 6. Proof A under scope A → should succeed.
  const scopeA = scopeOf("smoke-revocation-scope-a");
  console.log("\n[A] generating proof under scope A ...");
  const a = await buildProof(privateKey, slots, tree, scopeA);

  console.log("[A] publicSignals.length =", a.publicSignals.length);
  console.log("[A] ps[0..3] =", a.publicSignals.slice(0, 4).map((x) => x.toString()));
  console.log("[A] scopeA   =", scopeA.toString());
  console.log("[A] root     =", root.toString());
  // Direct Groth16 check for diagnosis
  const groth = await ethers.getContractAt(
    ["function verifyProof(uint[2],uint[2][2],uint[2],uint[52]) view returns (bool)"],
    "0x3a442161cb51555bab8f59351e5e1704e8200506",
  );
  const pA = [a.proofArray[0], a.proofArray[1]];
  const pB = [[a.proofArray[2], a.proofArray[3]], [a.proofArray[4], a.proofArray[5]]];
  const pC = [a.proofArray[6], a.proofArray[7]];
  const ok = await groth.verifyProof(pA, pB, pC, a.publicSignals);
  console.log("[A] groth16.verifyProof =", ok);
  console.log("[A] registry.isValidRoot(root) =", await registry.isValidRoot(root));
  console.log("[A] verifier.registry()       =", await verifier.registry());
  console.log("[A] verifier.isNullifierUsed  =", await verifier.isNullifierUsed(a.nullifierHash));
  console.log("[A] revocation.isRootRevoked  =", await revocation.isRootRevoked(root));
  console.log("[A] revocation.isNullRevoked  =", await revocation.isNullifierRevoked(a.nullifierHash));
  console.log("[A] verifyAndRecord (sending tx) ...");
  const txA = await verifier.verifyAndRecord(a.proofArray, a.publicSignals, scopeA, { gasLimit: 700000 });
  const rcA = await txA.wait();
  console.log("[A] OK gas=", rcA!.gasUsed.toString());
  if (!(await verifier.isNullifierUsed(a.nullifierHash))) {
    throw new Error("[A] nullifier not recorded");
  }

  // 7. Revoke the root.
  console.log("\nrevoking root ...");
  const txR = await revocation.revokeRoot(root);
  await txR.wait();
  if (!(await revocation.isRootRevoked(root))) throw new Error("root revocation did not stick");
  console.log("root revoked");

  // 8. Proof B under scope B → should revert with "root revoked".
  const scopeB = scopeOf("smoke-revocation-scope-b");
  console.log("\n[B] generating proof under scope B ...");
  const b = await buildProof(privateKey, slots, tree, scopeB);

  console.log("[B] verifyAndRecord (expecting revert) ...");
  let reverted = false;
  let reason = "";
  try {
    await verifier.verifyAndRecord.staticCall(b.proofArray, b.publicSignals, scopeB);
  } catch (e: any) {
    reverted = true;
    reason = e?.shortMessage || e?.reason || e?.message || String(e);
  }
  if (!reverted) {
    throw new Error("[B] FAIL — expected revert, but call succeeded");
  }
  if (!reason.includes("root revoked")) {
    throw new Error(`[B] reverted, but with wrong reason: ${reason}`);
  }
  console.log("[B] reverted as expected:", reason);

  console.log("\n✅ W1 root revocation enforcement is LIVE on HashKey Chain Testnet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
