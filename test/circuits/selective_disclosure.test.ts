import { expect } from "chai";
import path from "path";
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { IMT } from "@zk-kit/imt";

const snarkjs = require("snarkjs");

const BUILD = path.join(__dirname, "../../circuits/build");
const WASM = path.join(BUILD, "selective_disclosure_js/selective_disclosure.wasm");
const ZKEY = path.join(BUILD, "selective_disclosure_final.zkey");
const VKEY = require(path.join(BUILD, "verification_key.json"));

const TREE_DEPTH = 20;
const NUM_SLOTS = 8;
const SET_SIZE = 4;

// Predicate types
const NONE = 0;
const EQUALS = 1;
const GREATER_EQUAL = 2;
const LESS_THAN = 3;
const IN_SET = 4;

// Helper: generate a random field element (small for testing)
function randomKey(): bigint {
  return BigInt(Math.floor(Math.random() * 2 ** 32)) + 1n;
}

// Helper: build identity + credential + tree, return everything needed for a proof
function setupIdentityAndTree(
  privateKey: bigint,
  slotData: bigint[],
  extraLeaves: bigint[] = []
) {
  // Identity
  const identityCommitment = poseidon1([privateKey]);

  // Credential hash = Poseidon(identityCommitment, slot[0..7])
  const credentialHash = poseidon9([identityCommitment, ...slotData]);

  // Build Merkle tree (depth 20, Poseidon hash, arity 2)
  const tree = new IMT(poseidon2, TREE_DEPTH, 0n, 2);

  // Add extra leaves first (to put our leaf at a non-zero index)
  for (const leaf of extraLeaves) {
    tree.insert(leaf);
  }

  // Add our credential
  const leafIndex = tree.depth === 0 ? 0 : tree.leaves.length;
  tree.insert(credentialHash);

  return { identityCommitment, credentialHash, tree, leafIndex: tree.leaves.length - 1 };
}

// Helper: build circuit input from components
function buildInput(
  privateKey: bigint,
  slotData: bigint[],
  tree: any,
  leafIndex: number,
  scope: bigint,
  predicateTypes: number[],
  predicateValues: bigint[],
  predicateSets: bigint[][]
) {
  const proof = tree.createProof(leafIndex);
  const nullifier = poseidon2([privateKey, scope]);

  // Pad predicate sets to SET_SIZE
  const paddedSets = predicateSets.map((set) => {
    const padded = [...set];
    while (padded.length < SET_SIZE) padded.push(0n);
    return padded.map(String);
  });

  return {
    // Private
    privateKey: privateKey.toString(),
    credentialData: slotData.map(String),
    merkleSiblings: proof.siblings.map((s: any) => (Array.isArray(s) ? s[0] : s).toString()),
    merklePathIndices: proof.pathIndices.map(String),
    // Public
    merkleRoot: tree.root.toString(),
    nullifierHash: nullifier.toString(),
    scope: scope.toString(),
    predicateTypes: predicateTypes.map(String),
    predicateValues: predicateValues.map(String),
    predicateSets: paddedSets,
  };
}

describe("SelectiveDisclosure Main Circuit", function () {
  this.timeout(120_000);

  // Shared test identity
  const privateKey = 12345678n;
  const scope = 9999n;

  // KYC-like credential:
  // slot[0]=credType(1), slot[1]=kycTier(3), slot[2]=active(1),
  // slot[3]=timestamp, slot[4]=jurisdiction(344=HK), slot[5]=issuer, slot[6]=0, slot[7]=0
  const slotData: bigint[] = [1n, 3n, 1n, 1712345678n, 344n, 42n, 0n, 0n];

  // All NONE predicates (no constraints)
  const nonePreds = Array(NUM_SLOTS).fill(NONE);
  const zeroVals = Array(NUM_SLOTS).fill(0n);
  const zeroSets: bigint[][] = Array(NUM_SLOTS).fill([]);

  let tree: any;
  let leafIndex: number;

  before(function () {
    // Setup tree with a few extra leaves for realism
    const extraLeaves = [poseidon1([111n]), poseidon1([222n]), poseidon1([333n])];
    const result = setupIdentityAndTree(privateKey, slotData, extraLeaves);
    tree = result.tree;
    leafIndex = result.leafIndex;
  });

  // ================================================================
  // Happy path
  // ================================================================
  it("should generate and verify a valid proof with no predicates", async function () {
    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      nonePreds, zeroVals, zeroSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });

  it("should verify with EQUALS predicate on credentialType", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    pTypes[0] = EQUALS;
    pVals[0] = 1n; // credentialType == 1

    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      pTypes, pVals, zeroSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });

  it("should verify with GREATER_EQUAL predicate on kycTier", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    pTypes[1] = GREATER_EQUAL;
    pVals[1] = 3n; // kycTier >= 3

    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      pTypes, pVals, zeroSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });

  it("should verify with IN_SET predicate on jurisdiction", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    const pSets = zeroSets.map(() => [] as bigint[]);
    pTypes[4] = IN_SET;
    pSets[4] = [344n, 840n, 826n]; // HK, US, UK

    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      pTypes, pVals, pSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });

  it("should verify with multiple predicates combined", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    const pSets = zeroSets.map(() => [] as bigint[]);

    pTypes[0] = EQUALS;       pVals[0] = 1n;      // credentialType == 1
    pTypes[1] = GREATER_EQUAL; pVals[1] = 2n;      // kycTier >= 2
    pTypes[2] = EQUALS;       pVals[2] = 1n;       // isActive == 1
    pTypes[4] = IN_SET;       pSets[4] = [344n, 840n]; // jurisdiction in {HK, US}

    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      pTypes, pVals, pSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });

  // ================================================================
  // Nullifier tests
  // ================================================================
  it("should produce different nullifiers for different scopes", async function () {
    const scope1 = 1000n;
    const scope2 = 2000n;

    const input1 = buildInput(
      privateKey, slotData, tree, leafIndex, scope1,
      nonePreds, zeroVals, zeroSets
    );
    const input2 = buildInput(
      privateKey, slotData, tree, leafIndex, scope2,
      nonePreds, zeroVals, zeroSets
    );

    const { publicSignals: ps1 } = await snarkjs.groth16.fullProve(input1, WASM, ZKEY);
    const { publicSignals: ps2 } = await snarkjs.groth16.fullProve(input2, WASM, ZKEY);

    // publicSignals layout: [allPredicatesPass, merkleRoot, nullifierHash, scope, ...]
    // nullifierHash is at index 2
    expect(ps1[2]).to.not.equal(ps2[2]);
  });

  it("should produce same nullifier for same scope (deterministic)", async function () {
    const input1 = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      nonePreds, zeroVals, zeroSets
    );
    const input2 = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      nonePreds, zeroVals, zeroSets
    );

    const { publicSignals: ps1 } = await snarkjs.groth16.fullProve(input1, WASM, ZKEY);
    const { publicSignals: ps2 } = await snarkjs.groth16.fullProve(input2, WASM, ZKEY);

    expect(ps1[2]).to.equal(ps2[2]);
  });

  // ================================================================
  // Failure cases
  // ================================================================
  it("should fail with wrong private key", async function () {
    const wrongKey = 99999999n;
    // Credential was committed with original key, so wrong key → wrong credential hash → wrong root
    const wrongIdentity = poseidon1([wrongKey]);
    const wrongCredHash = poseidon9([wrongIdentity, ...slotData]);

    // The proof will still be valid snarkjs-side, but the root won't match
    // Actually, circom will fail because the Merkle root constraint won't be satisfied
    try {
      const input = buildInput(
        wrongKey, slotData, tree, leafIndex, scope,
        nonePreds, zeroVals, zeroSets
      );
      // Override the nullifier to match wrongKey (so nullifier constraint passes)
      input.nullifierHash = poseidon2([wrongKey, scope]).toString();

      await snarkjs.groth16.fullProve(input, WASM, ZKEY);
      expect.fail("Should have thrown — wrong key means wrong credential hash and wrong root");
    } catch (e: any) {
      // Expected: circuit constraint fails (merkle root mismatch)
      expect(e.message).to.include("Assert Failed");
    }
  });

  it("should fail when predicate is not satisfied", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    pTypes[1] = GREATER_EQUAL;
    pVals[1] = 5n; // kycTier >= 5, but actual is 3

    try {
      const input = buildInput(
        privateKey, slotData, tree, leafIndex, scope,
        pTypes, pVals, zeroSets
      );
      await snarkjs.groth16.fullProve(input, WASM, ZKEY);
      expect.fail("Should have thrown — predicate not satisfied");
    } catch (e: any) {
      expect(e.message).to.include("Assert Failed");
    }
  });

  it("should fail when IN_SET predicate value is not in the set", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    const pSets = zeroSets.map(() => [] as bigint[]);
    pTypes[4] = IN_SET;
    pSets[4] = [840n, 826n, 392n]; // US, UK, Japan — NOT 344 (HK)

    try {
      const input = buildInput(
        privateKey, slotData, tree, leafIndex, scope,
        pTypes, pVals, pSets
      );
      await snarkjs.groth16.fullProve(input, WASM, ZKEY);
      expect.fail("Should have thrown — jurisdiction not in set");
    } catch (e: any) {
      expect(e.message).to.include("Assert Failed");
    }
  });

  it("should fail with tampered public signals (proof forgery)", async function () {
    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      nonePreds, zeroVals, zeroSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);

    // Tamper with the merkle root
    const tampered = [...publicSignals];
    tampered[1] = "12345";

    const valid = await snarkjs.groth16.verify(VKEY, tampered, proof);
    expect(valid).to.be.false;
  });

  // ================================================================
  // LESS_THAN predicate
  // ================================================================
  it("should verify with LESS_THAN predicate on timestamp", async function () {
    const pTypes = [...nonePreds];
    const pVals = [...zeroVals];
    pTypes[3] = LESS_THAN;
    pVals[3] = 2000000000n; // timestamp < 2B (year ~2033)

    const input = buildInput(
      privateKey, slotData, tree, leafIndex, scope,
      pTypes, pVals, zeroSets
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
    const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
    expect(valid).to.be.true;
  });
});
