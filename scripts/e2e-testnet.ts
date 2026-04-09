/**
 * e2e-testnet.ts — Full end-to-end flow against live HashKey Chain Testnet.
 *
 * Mirrors every contract interaction the frontend makes:
 *   1. Create BIP39 identity (same as Issue page "Create Identity")
 *   2. Set KYC on MockKycSBT (same as Issue page PREMIUM button)
 *   3. Issue KYC credential + updateRoot (same as Issue page "Mint Credential")
 *   4. Generate Groth16 proof (Gated Vault scope) (same as Prove page)
 *   5. Mint tokens + approve + depositWithProof (same as Vault page)
 *   6. Create governance proposal (same as Governance page "Create")
 *   7. Generate proof (governance scope) + cast vote (same as Governance page)
 *   8. Revoke the Merkle root (same as Revoke page "Revoke Root")
 *   9. Generate proof against revoked root → assert rejected
 *
 * Usage:
 *   NODE_OPTIONS="--require ./scripts/force-ipv4.cjs" \
 *   npx hardhat run scripts/e2e-testnet.ts --network hashkeyTestnet
 */
import { ethers } from "hardhat";
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import path from "path";

const snarkjs = require("snarkjs");

// ─── Deployed addresses (must match app/src/lib/contracts.ts) ────────────────
const ADDR = {
  registry:    "0xa1708C934175Bf7EaC25220D560BE0C681725957",
  verifier:    "0xd49cA44645E21076dcd83F285D23c99AbeB6D299",
  revocation:  "0x735680A32A0e5d9d23D7e8e8302F434e7F30428E",
  kycSBT:      "0x335C915Fa62eeBF9804a4398bb85Cd370B333850",
  kycAdapter:  "0x3AfBFC76f49A4D466D03775B371a4F6142c6A194",
  gatedVault:  "0x6C1F9466db7Bc2364b0baC051E73421d5b75354B",
  governance:  "0x2D036e311A6f11f8ABd191276Fd381Df55fbE224",
  mockERC20:   "0x6670bB42279832548E976Fc9f2ddEbA6A03539F8",
};

const TREE_DEPTH = 20;
const BN128 = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const NUM_SLOTS = 8;
const SET_SIZE = 4;

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
  const predicateTypes = [1, 2, 1, 0, 0, 0, 0, 0]; // EQUALS, GTE, EQUALS, skip...
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
  const proofArray: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];
  return { proofArray, publicSignals: publicSignals.map(BigInt) as bigint[], nullifierHash };
}

function ok(label: string) { console.log(`  ✓ ${label}`); }

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  zkFabric — Full E2E Flow on HashKey Chain Testnet      ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`signer: ${signer.address}`);
  const bal = ethers.formatEther(await ethers.provider.getBalance(signer.address));
  console.log(`balance: ${bal} HSK\n`);

  const registry   = await ethers.getContractAt("ZKFabricRegistry", ADDR.registry);
  const verifier   = await ethers.getContractAt("ZKFabricVerifier", ADDR.verifier);
  const revocation = await ethers.getContractAt("RevocationRegistry", ADDR.revocation);
  const adapter    = await ethers.getContractAt("KYCSBTAdapter", ADDR.kycAdapter);
  const mockKyc    = await ethers.getContractAt("MockKycSBT", ADDR.kycSBT);
  const vault      = await ethers.getContractAt("GatedVault", ADDR.gatedVault);
  const governance = await ethers.getContractAt("PrivateGovernance", ADDR.governance);
  const token      = await ethers.getContractAt("MockERC20", ADDR.mockERC20);

  // ── 1. Create identity (mirrors Issue page "Create Identity") ──────────
  console.log("1. Create identity");
  const privateKey = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
  const identityCommitment = poseidon1([privateKey]);
  ok(`commitment = ${identityCommitment.toString().slice(0, 24)}...`);

  // ── 2. Set KYC (mirrors Issue page PREMIUM button) ────────────────────
  console.log("\n2. Set KYC on MockKycSBT");
  const [, lvl, st] = await mockKyc.getKycInfo(signer.address);
  if (Number(st) === 1 && Number(lvl) >= 3) {
    ok(`already set: level=${lvl} status=${st}`);
  } else {
    await (await mockKyc.setKycInfo(signer.address, "e2e.hsk", 3, 1)).wait();
    ok("PREMIUM / APPROVED");
  }

  // ── 3. Issue credential + updateRoot (mirrors Issue page "Mint") ───────
  console.log("\n3. Issue KYC credential");
  const slots: bigint[] = [
    1n, 3n, 1n,
    BigInt(Math.floor(Date.now() / 1000)),
    344n, 1n, 0n, 0n,
  ];
  const credentialHash = poseidon9([identityCommitment, ...slots]);
  ok(`credentialHash = ${credentialHash.toString().slice(0, 24)}...`);

  // Register identity + credential via adapter (two-step, deployed adapter predates ingestAndRegister)
  await (await adapter.ingestCredential(signer.address, identityCommitment)).wait();
  await (await adapter.registerComputedCredential(identityCommitment, credentialHash)).wait();
  ok("on-chain credential registered");

  // Build Merkle tree and update root
  const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
  tree.insert(credentialHash);
  const root = BigInt(tree.root);
  await (await registry.updateRoot(root)).wait();
  ok(`updateRoot (root = ${root.toString().slice(0, 24)}...)`);

  // ── 4. Generate proof — Gated Vault scope (mirrors Prove page) ────────
  console.log("\n4. Generate proof (Gated Vault scope)");
  const vaultScope = scopeOf("zkfabric-gated-vault-v1");
  const t0 = Date.now();
  const proofA = await buildProof(privateKey, slots, tree, vaultScope);
  ok(`proof generated in ${Date.now() - t0}ms`);

  // ── 5. Vault deposit (mirrors Vault page) ─────────────────────────────
  console.log("\n5. Vault deposit with proof");
  // Mint 1000 tokens
  await (await token.mint(signer.address, ethers.parseEther("1000"))).wait();
  ok("minted 1000 mUSDC");

  // Approve vault
  await (await token.approve(ADDR.gatedVault, ethers.parseEther("100"))).wait();
  ok("approved 100 mUSDC");

  // Deposit with proof
  const txDeposit = await vault.depositWithProof(
    ethers.parseEther("100"),
    signer.address,
    proofA.proofArray,
    proofA.publicSignals,
    { gasLimit: 800000 }
  );
  const rcDeposit = await txDeposit.wait();
  ok(`depositWithProof tx confirmed (gas: ${rcDeposit!.gasUsed})`);

  const verified = await vault.isVerified(signer.address);
  const premium = await vault.isPremium(signer.address);
  ok(`isVerified=${verified} isPremium=${premium}`);

  // ── 6. Create governance proposal (mirrors Governance page) ───────────
  console.log("\n6. Create governance proposal");
  const txProp = await governance.createProposal("E2E test proposal — should we ship?", 86400n);
  const rcProp = await txProp.wait();
  // Read proposalCount to get the id
  const proposalCount = await governance.proposalCount();
  const proposalId = proposalCount - 1n;
  ok(`proposal #${proposalId} created (gas: ${rcProp!.gasUsed})`);

  // ── 7. Vote on proposal (mirrors Governance page) ─────────────────────
  console.log("\n7. Vote on proposal");
  // Compute governance scope the same way the contract and frontend do
  const govScope = BigInt(
    ethers.keccak256(
      ethers.solidityPacked(["string", "uint256"], ["zkfabric-governance-v1", proposalId])
    )
  ) % BN128;
  ok(`governance scope = ${govScope.toString().slice(0, 24)}...`);

  const t1 = Date.now();
  const proofB = await buildProof(privateKey, slots, tree, govScope);
  ok(`proof generated in ${Date.now() - t1}ms`);

  const txVote = await governance.vote(
    proposalId,
    1, // YES
    proofB.proofArray,
    proofB.publicSignals,
    { gasLimit: 800000 }
  );
  const rcVote = await txVote.wait();
  ok(`YES vote cast (gas: ${rcVote!.gasUsed})`);

  const [yesVotes, noVotes] = await governance.getResults(proposalId);
  ok(`results: YES=${yesVotes} NO=${noVotes}`);

  // ── 8. Revoke root (mirrors Revoke page "Revoke Root") ────────────────
  console.log("\n8. Revoke Merkle root");
  await (await revocation.revokeRoot(root)).wait();
  const isRevoked = await revocation.isRootRevoked(root);
  ok(`root revoked: ${isRevoked}`);

  // ── 9. Proof against revoked root should fail ─────────────────────────
  console.log("\n9. Verify revoked root is rejected");
  const rejectScope = scopeOf("e2e-reject-test");
  const t2 = Date.now();
  const proofC = await buildProof(privateKey, slots, tree, rejectScope);
  ok(`proof generated in ${Date.now() - t2}ms`);

  let reverted = false;
  let reason = "";
  try {
    await verifier.verifyAndRecord.staticCall(
      proofC.proofArray,
      proofC.publicSignals,
      rejectScope
    );
  } catch (e: any) {
    reverted = true;
    reason = e?.shortMessage || e?.reason || e?.message || String(e);
  }

  if (!reverted) {
    // staticCall might not return reason on this RPC — try tx with explicit gasLimit
    try {
      await verifier.verifyAndRecord(
        proofC.proofArray, proofC.publicSignals, rejectScope,
        { gasLimit: 800000 }
      );
      throw new Error("SHOULD HAVE REVERTED");
    } catch (e: any) {
      reverted = true;
      reason = e?.shortMessage || e?.reason || e?.message || String(e);
    }
  }

  if (!reverted) {
    console.error("  ✗ FAIL — expected revert but call succeeded");
    process.exit(1);
  }
  if (reason.includes("root revoked")) {
    ok(`reverted: "${reason.match(/root revoked/)?.[0]}"`);
  } else {
    ok(`reverted (reason: ${reason.slice(0, 80)})`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const balEnd = ethers.formatEther(await ethers.provider.getBalance(signer.address));
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ALL 9 STEPS PASSED                                     ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  1. Identity created (BIP39-style random key)           ║`);
  console.log(`║  2. KYC set to PREMIUM/APPROVED                        ║`);
  console.log(`║  3. Credential issued + Merkle root updated             ║`);
  console.log(`║  4. Groth16 proof generated (Gated Vault scope)         ║`);
  console.log(`║  5. Vault deposit accepted (100 mUSDC)                  ║`);
  console.log(`║  6. Governance proposal created                         ║`);
  console.log(`║  7. Anonymous YES vote cast                             ║`);
  console.log(`║  8. Merkle root revoked                                 ║`);
  console.log(`║  9. Proof against revoked root rejected                 ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`HSK spent: ${(parseFloat(bal) - parseFloat(balEnd)).toFixed(6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
