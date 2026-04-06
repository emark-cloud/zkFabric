/**
 * demo-flow.ts — Full end-to-end demo of zkFabric
 *
 * Runs against local Hardhat node:
 *   npx hardhat node
 *   npx hardhat run scripts/demo-flow.ts --network localhost
 *
 * Flow: deploy → create identity → set KYC → ingest → compute credential →
 *       register on-chain → build Merkle tree → generate proof → verify on-chain → deposit
 */
import { ethers } from "hardhat";
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import path from "path";

const snarkjs = require("snarkjs");

const TREE_DEPTH = 20;
const NUM_SLOTS = 8;
const SET_SIZE = 4;

const BUILD = path.join(__dirname, "../circuits/build");
const WASM = path.join(BUILD, "selective_disclosure_js/selective_disclosure.wasm");
const ZKEY = path.join(BUILD, "selective_disclosure_final.zkey");

async function main() {
  const [deployer, user] = await ethers.getSigners();
  console.log("=== zkFabric Demo Flow ===\n");
  console.log("Deployer:", deployer.address);
  console.log("User:", user.address);

  // ================================================================
  // 1. Deploy all contracts
  // ================================================================
  console.log("\n--- 1. Deploying contracts ---");

  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  console.log("Groth16Verifier:", await groth16Verifier.getAddress());

  const Registry = await ethers.getContractFactory("ZKFabricRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("Registry:", await registry.getAddress());

  const Verifier = await ethers.getContractFactory("ZKFabricVerifier");
  const verifier = await Verifier.deploy(await groth16Verifier.getAddress());
  await verifier.waitForDeployment();
  await verifier.setRegistry(await registry.getAddress());
  console.log("Verifier:", await verifier.getAddress());

  const MockKyc = await ethers.getContractFactory("MockKycSBT");
  const mockKyc = await MockKyc.deploy();
  await mockKyc.waitForDeployment();

  const Adapter = await ethers.getContractFactory("KYCSBTAdapter");
  const adapter = await Adapter.deploy(
    await mockKyc.getAddress(),
    await registry.getAddress()
  );
  await adapter.waitForDeployment();
  await registry.authorizeAdapter(await adapter.getAddress());
  console.log("KYCSBTAdapter:", await adapter.getAddress(), "(authorized)");

  const MockToken = await ethers.getContractFactory("MockERC20");
  const token = await MockToken.deploy("Mock USDC", "mUSDC");
  await token.waitForDeployment();

  const Vault = await ethers.getContractFactory("GatedVault");
  const vault = await Vault.deploy(
    await token.getAddress(),
    await verifier.getAddress(),
    "zkFabric Vault",
    "zfVault"
  );
  await vault.waitForDeployment();
  console.log("GatedVault:", await vault.getAddress());

  // ================================================================
  // 2. Create identity (off-chain)
  // ================================================================
  console.log("\n--- 2. Creating identity ---");
  const privateKey = 12345678n; // deterministic for demo
  const identityCommitment = poseidon1([privateKey]);
  console.log("Private key:", privateKey.toString());
  console.log("Identity commitment:", identityCommitment.toString().slice(0, 30) + "...");

  // ================================================================
  // 3. Set KYC status (mock)
  // ================================================================
  console.log("\n--- 3. Setting KYC status ---");
  await mockKyc.setKycInfo(user.address, "demo.hsk", 3, 1); // PREMIUM, APPROVED
  const [ensName, level, status] = await mockKyc.getKycInfo(user.address);
  console.log(`KYC: ${ensName}, level=${level}, status=${status}`);

  // ================================================================
  // 4. Ingest credential via adapter
  // ================================================================
  console.log("\n--- 4. Ingesting credential ---");
  await adapter.ingestCredential(user.address, identityCommitment);
  console.log("Identity registered:", await registry.isIdentityRegistered(identityCommitment));

  // ================================================================
  // 5. Compute credential hash (off-chain Poseidon)
  // ================================================================
  console.log("\n--- 5. Computing credential ---");
  const slots = [
    1n,                // credentialType: KYC_SBT
    3n,                // kycTier: PREMIUM
    1n,                // isActive
    BigInt(Math.floor(Date.now() / 1000)), // timestamp
    344n,              // jurisdiction: HK
    1n,                // issuer
    0n,                // aux1
    0n,                // aux2
  ];
  const credentialHash = poseidon9([identityCommitment, ...slots]);
  console.log("Credential hash:", credentialHash.toString().slice(0, 30) + "...");

  // Register on-chain
  await adapter.registerComputedCredential(identityCommitment, credentialHash);
  console.log("Credential registered:", await registry.isCredentialRegistered(credentialHash));

  // ================================================================
  // 6. Build Merkle tree and update root
  // ================================================================
  console.log("\n--- 6. Building Merkle tree ---");
  const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
  tree.insert(credentialHash);
  const merkleRoot = tree.root;
  console.log("Merkle root:", BigInt(merkleRoot).toString().slice(0, 30) + "...");

  // Update root in registry
  await registry.updateRoot(merkleRoot);
  console.log("Root registered:", await registry.isValidRoot(merkleRoot));

  // ================================================================
  // 7. Generate ZK proof
  // ================================================================
  console.log("\n--- 7. Generating ZK proof ---");
  const BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const vaultScope = BigInt(
    ethers.keccak256(ethers.toUtf8Bytes("zkfabric-gated-vault-v1"))
  ) % BN128_FIELD_PRIME;
  const nullifierHash = poseidon2([privateKey, vaultScope]);
  const merkleProof = tree.createProof(0);

  // Build predicates: slot[0]=EQUALS(1), slot[1]=GREATER_EQUAL(3), slot[2]=EQUALS(1)
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
    merkleRoot: BigInt(merkleRoot).toString(),
    nullifierHash: nullifierHash.toString(),
    scope: vaultScope.toString(),
    predicateTypes: predicateTypes.map(String),
    predicateValues: predicateValues.map(String),
    predicateSets,
  };

  const start = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  console.log(`Proof generated in ${Date.now() - start}ms`);
  console.log("allPredicatesPass:", publicSignals[0]);
  console.log("nullifierHash:", publicSignals[2].slice(0, 30) + "...");

  // ================================================================
  // 8. On-chain verification via verifier
  // ================================================================
  console.log("\n--- 8. Verifying proof on-chain ---");
  // Format proof for on-chain
  // pi_b elements swapped within each G2 point for Solidity verifier
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

  // ================================================================
  // 9. Deposit into vault with proof
  // ================================================================
  console.log("\n--- 9. Depositing into vault ---");
  // Mint tokens to user
  await token.mint(user.address, ethers.parseEther("1000"));
  await token.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
  console.log("User token balance:", ethers.formatEther(await token.balanceOf(user.address)));

  // Deposit with proof
  const tx = await vault.connect(user).depositWithProof(
    ethers.parseEther("100"),
    user.address,
    proofArray,
    publicSignals.map(BigInt)
  );
  const receipt = await tx.wait();
  console.log("Deposit tx gas:", receipt!.gasUsed.toString());
  console.log("Vault total assets:", ethers.formatEther(await vault.totalAssets()));
  console.log("User verified:", await vault.isVerified(user.address));
  console.log("User premium:", await vault.isPremium(user.address));

  // ================================================================
  // 10. Verify nullifier is spent
  // ================================================================
  console.log("\n--- 10. Checking nullifier ---");
  console.log("Nullifier used:", await verifier.isNullifierUsed(nullifierHash));

  console.log("\n=== Demo Complete! ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
