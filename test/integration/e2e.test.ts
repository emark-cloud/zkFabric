import { expect } from "chai";
import { ethers } from "hardhat";
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";
import path from "path";

const snarkjs = require("snarkjs");

const TREE_DEPTH = 20;
const NUM_SLOTS = 8;
const SET_SIZE = 4;

const BUILD = path.join(__dirname, "../../circuits/build");
const WASM = path.join(BUILD, "selective_disclosure_js/selective_disclosure.wasm");
const ZKEY = path.join(BUILD, "selective_disclosure_final.zkey");
const VKEY = require(path.join(BUILD, "verification_key.json"));

describe("End-to-End Integration", function () {
  this.timeout(120_000);

  let deployer: any, user: any;
  let registry: any, verifier: any, mockKyc: any, adapter: any;
  let token: any, vault: any;

  // Identity
  const privateKey = 12345678n;
  const identityCommitment = poseidon1([privateKey]);

  // KYC credential slots
  const slots = [1n, 3n, 1n, 1712345678n, 344n, 1n, 0n, 0n];
  const credentialHash = poseidon9([identityCommitment, ...slots]);

  before(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy all contracts
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const groth16Verifier = await Groth16Verifier.deploy();
    await groth16Verifier.waitForDeployment();

    const Registry = await ethers.getContractFactory("ZKFabricRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    const Verifier = await ethers.getContractFactory("ZKFabricVerifier");
    verifier = await Verifier.deploy(await groth16Verifier.getAddress());
    await verifier.waitForDeployment();
    await verifier.setRegistry(await registry.getAddress());

    const MockKyc = await ethers.getContractFactory("MockKycSBT");
    mockKyc = await MockKyc.deploy();
    await mockKyc.waitForDeployment();

    const Adapter = await ethers.getContractFactory("KYCSBTAdapter");
    adapter = await Adapter.deploy(
      await mockKyc.getAddress(),
      await registry.getAddress()
    );
    await adapter.waitForDeployment();
    await registry.authorizeAdapter(await adapter.getAddress());

    const MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Mock USDC", "mUSDC");
    await token.waitForDeployment();

    const Vault = await ethers.getContractFactory("GatedVault");
    vault = await Vault.deploy(
      await token.getAddress(),
      await verifier.getAddress(),
      "zkFabric Vault",
      "zfVault"
    );
    await vault.waitForDeployment();
  });

  it("should complete the full flow: KYC → credential → proof → vault deposit", async function () {
    // 1. Set KYC
    await mockKyc.setKycInfo(user.address, "demo.hsk", 3, 1);

    // 2. Ingest identity via adapter
    await adapter.ingestCredential(user.address, identityCommitment);
    expect(await registry.isIdentityRegistered(identityCommitment)).to.be.true;

    // 3. Register computed credential hash
    await adapter.registerComputedCredential(identityCommitment, credentialHash);
    expect(await registry.isCredentialRegistered(credentialHash)).to.be.true;

    // 4. Build Merkle tree + register root
    const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
    tree.insert(credentialHash);
    await registry.updateRoot(tree.root);
    expect(await registry.isValidRoot(tree.root)).to.be.true;

    // 5. Generate ZK proof
    const BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const vaultScope = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("zkfabric-gated-vault-v1"))
    ) % BN128_FIELD_PRIME;
    const nullifierHash = poseidon2([privateKey, vaultScope]);
    const merkleProof = tree.createProof(0);

    const input = {
      privateKey: privateKey.toString(),
      credentialData: slots.map(String),
      merkleSiblings: merkleProof.siblings.map((s: any) =>
        (Array.isArray(s) ? s[0] : s).toString()
      ),
      merklePathIndices: merkleProof.pathIndices.map(String),
      merkleRoot: BigInt(tree.root).toString(),
      nullifierHash: nullifierHash.toString(),
      scope: vaultScope.toString(),
      predicateTypes: ["1", "2", "1", "0", "0", "0", "0", "0"],
      predicateValues: ["1", "3", "1", "0", "0", "0", "0", "0"],
      predicateSets: Array.from({ length: NUM_SLOTS }, () =>
        new Array(SET_SIZE).fill("0")
      ),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM,
      ZKEY
    );

    // Verify locally first
    const localValid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(localValid).to.be.true;
    expect(publicSignals[0]).to.equal("1"); // allPredicatesPass

    // 6. Format for on-chain (pi_b elements swapped within each G2 point for Solidity)
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

    // 7. Mint tokens + deposit with proof
    await token.mint(user.address, ethers.parseEther("1000"));
    await token
      .connect(user)
      .approve(await vault.getAddress(), ethers.parseEther("100"));

    const tx = await vault
      .connect(user)
      .depositWithProof(
        ethers.parseEther("100"),
        user.address,
        proofArray,
        publicSignals.map(BigInt)
      );
    const receipt = await tx.wait();

    // 8. Verify post-conditions
    expect(await vault.totalAssets()).to.equal(ethers.parseEther("100"));
    expect(await vault.isVerified(user.address)).to.be.true;
    expect(await vault.isPremium(user.address)).to.be.true;
    expect(await verifier.isNullifierUsed(nullifierHash)).to.be.true;

    console.log(`    Gas used: ${receipt!.gasUsed.toString()}`);
  });

  it("should reject double deposit (nullifier already used)", async function () {
    // Same user tries again with the same proof scope
    const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
    tree.insert(credentialHash);

    const BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const vaultScope = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("zkfabric-gated-vault-v1"))
    ) % BN128_FIELD_PRIME;
    const nullifierHash = poseidon2([privateKey, vaultScope]);
    const merkleProof = tree.createProof(0);

    const input = {
      privateKey: privateKey.toString(),
      credentialData: slots.map(String),
      merkleSiblings: merkleProof.siblings.map((s: any) =>
        (Array.isArray(s) ? s[0] : s).toString()
      ),
      merklePathIndices: merkleProof.pathIndices.map(String),
      merkleRoot: BigInt(tree.root).toString(),
      nullifierHash: nullifierHash.toString(),
      scope: vaultScope.toString(),
      predicateTypes: ["1", "2", "1", "0", "0", "0", "0", "0"],
      predicateValues: ["1", "3", "1", "0", "0", "0", "0", "0"],
      predicateSets: Array.from({ length: NUM_SLOTS }, () =>
        new Array(SET_SIZE).fill("0")
      ),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM,
      ZKEY
    );

    const proofArray = [
      BigInt(proof.pi_a[0]),
      BigInt(proof.pi_a[1]),
      BigInt(proof.pi_b[0][0]),
      BigInt(proof.pi_b[0][1]),
      BigInt(proof.pi_b[1][0]),
      BigInt(proof.pi_b[1][1]),
      BigInt(proof.pi_c[0]),
      BigInt(proof.pi_c[1]),
    ];

    await expect(
      vault
        .connect(user)
        .depositWithProof(
          ethers.parseEther("50"),
          user.address,
          proofArray,
          publicSignals.map(BigInt)
        )
    ).to.be.revertedWith("ZKFabricVerifier: nullifier already used");
  });

  it("should reject proofs against revoked roots", async function () {
    // Wire a fresh RevocationRegistry into the verifier
    const RevReg = await ethers.getContractFactory("RevocationRegistry");
    const revocationRegistry = await RevReg.deploy();
    await revocationRegistry.waitForDeployment();
    await verifier.setRevocationRegistry(await revocationRegistry.getAddress());

    // Build a proof under a fresh scope (avoid nullifier collision with prior tests)
    const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);
    tree.insert(credentialHash);
    await registry.updateRoot(tree.root);

    const BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const revocationScope = BigInt(
      ethers.keccak256(ethers.toUtf8Bytes("zkfabric-revocation-test"))
    ) % BN128_FIELD_PRIME;
    const nullifierHash = poseidon2([privateKey, revocationScope]);
    const merkleProof = tree.createProof(0);

    const input = {
      privateKey: privateKey.toString(),
      credentialData: slots.map(String),
      merkleSiblings: merkleProof.siblings.map((s: any) =>
        (Array.isArray(s) ? s[0] : s).toString()
      ),
      merklePathIndices: merkleProof.pathIndices.map(String),
      merkleRoot: BigInt(tree.root).toString(),
      nullifierHash: nullifierHash.toString(),
      scope: revocationScope.toString(),
      predicateTypes: ["1", "2", "1", "0", "0", "0", "0", "0"],
      predicateValues: ["1", "3", "1", "0", "0", "0", "0", "0"],
      predicateSets: Array.from({ length: NUM_SLOTS }, () =>
        new Array(SET_SIZE).fill("0")
      ),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM,
      ZKEY
    );

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

    // Issuer revokes the root
    await revocationRegistry.revokeRoot(BigInt(tree.root));

    // Direct verifier call should now revert
    await expect(
      verifier.verifyAndRecord(proofArray, publicSignals.map(BigInt), revocationScope)
    ).to.be.revertedWith("ZKFabricVerifier: root revoked");

    // Restore root, then revoke the nullifier instead
    await revocationRegistry.restoreRoot(BigInt(tree.root));
    await revocationRegistry.revokeNullifier(nullifierHash);

    await expect(
      verifier.verifyAndRecord(proofArray, publicSignals.map(BigInt), revocationScope)
    ).to.be.revertedWith("ZKFabricVerifier: nullifier revoked");

    // Cleanup: unwire revocation registry so other test files / suites are unaffected
    await revocationRegistry.restoreNullifier(nullifierHash);
    await verifier.setRevocationRegistry(ethers.ZeroAddress);
  });
});
