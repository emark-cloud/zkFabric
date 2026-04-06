import { poseidon2 } from "poseidon-lite";
import {
  CircuitArtifacts,
  MerkleProof,
  Predicate,
  PredicateType,
  ProofRequest,
  ZKProof,
  NUM_SLOTS,
  SET_SIZE,
} from "./types";

// snarkjs is CJS
const snarkjs = require("snarkjs");

/**
 * Build the circuit input object from identity, credential, tree proof, and predicates.
 */
export function buildCircuitInput(
  privateKey: bigint,
  credentialData: bigint[],
  merkleProof: MerkleProof,
  scope: bigint,
  predicates: Predicate[]
): Record<string, string | string[] | string[][]> {
  if (credentialData.length !== NUM_SLOTS) {
    throw new Error(`Expected ${NUM_SLOTS} credential slots`);
  }

  const nullifierHash = poseidon2([privateKey, scope]);

  // Initialize all predicates as NONE
  const predicateTypes = new Array(NUM_SLOTS).fill("0");
  const predicateValues = new Array(NUM_SLOTS).fill("0");
  const predicateSets: string[][] = Array.from({ length: NUM_SLOTS }, () =>
    new Array(SET_SIZE).fill("0")
  );

  // Apply requested predicates
  for (const pred of predicates) {
    if (pred.slot < 0 || pred.slot >= NUM_SLOTS) {
      throw new Error(`Invalid slot index: ${pred.slot}`);
    }
    predicateTypes[pred.slot] = String(pred.op);
    predicateValues[pred.slot] = pred.value.toString();

    if (pred.op === PredicateType.IN_SET && pred.set) {
      if (pred.set.length > SET_SIZE) {
        throw new Error(`Set size exceeds maximum of ${SET_SIZE}`);
      }
      for (let i = 0; i < pred.set.length; i++) {
        predicateSets[pred.slot][i] = pred.set[i].toString();
      }
    }
  }

  return {
    // Private inputs
    privateKey: privateKey.toString(),
    credentialData: credentialData.map(String),
    merkleSiblings: merkleProof.siblings.map(String),
    merklePathIndices: merkleProof.pathIndices.map(String),
    // Public inputs
    merkleRoot: merkleProof.root.toString(),
    nullifierHash: nullifierHash.toString(),
    scope: scope.toString(),
    predicateTypes,
    predicateValues,
    predicateSets,
  };
}

/**
 * Generate a Groth16 proof for selective disclosure.
 */
export async function generateProof(
  privateKey: bigint,
  credentialData: bigint[],
  merkleProof: MerkleProof,
  request: ProofRequest,
  artifacts: CircuitArtifacts
): Promise<ZKProof> {
  const input = buildCircuitInput(
    privateKey,
    credentialData,
    merkleProof,
    request.scope,
    request.predicates
  );

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    artifacts.wasmPath,
    artifacts.zkeyPath
  );

  // Parse public signals to bigints
  const signals = publicSignals.map(BigInt);

  // Signal layout: [0]=allPredicatesPass, [1]=merkleRoot, [2]=nullifierHash, [3]=scope,
  // [4-11]=predicateTypes[8], [12-19]=predicateValues[8], [20-51]=predicateSets[8][4]
  // pi_b elements swapped within each G2 point for Solidity verifier
  return {
    proof: [
      BigInt(proof.pi_a[0]),
      BigInt(proof.pi_a[1]),
      BigInt(proof.pi_b[0][1]),
      BigInt(proof.pi_b[0][0]),
      BigInt(proof.pi_b[1][1]),
      BigInt(proof.pi_b[1][0]),
      BigInt(proof.pi_c[0]),
      BigInt(proof.pi_c[1]),
    ],
    publicSignals: signals,
    nullifierHash: signals[2],
    merkleRoot: signals[1],
  };
}

/**
 * Verify a proof locally (for testing/debugging).
 */
export async function verifyProof(
  zkProof: ZKProof,
  artifacts: CircuitArtifacts
): Promise<boolean> {
  if (!artifacts.vkeyPath) {
    throw new Error("Verification key path required for local verification");
  }

  // Load vkey - Node.js only (not available in browser)
  let vkey: any;
  try {
    vkey = require(artifacts.vkeyPath);
  } catch {
    // Dynamic import so bundlers don't resolve fs at compile time
    const fs = await import(/* webpackIgnore: true */ "fs");
    vkey = JSON.parse(fs.readFileSync(artifacts.vkeyPath, "utf-8"));
  }

  // Reconstruct snarkjs proof format (reverse the pi_b swap)
  const proof = {
    pi_a: [zkProof.proof[0].toString(), zkProof.proof[1].toString(), "1"],
    pi_b: [
      [zkProof.proof[3].toString(), zkProof.proof[2].toString()],
      [zkProof.proof[5].toString(), zkProof.proof[4].toString()],
      ["1", "0"],
    ],
    pi_c: [zkProof.proof[6].toString(), zkProof.proof[7].toString(), "1"],
    protocol: "groth16",
    curve: "bn128",
  };

  const signals = zkProof.publicSignals.map(String);
  return snarkjs.groth16.verify(vkey, signals, proof);
}

/**
 * Format proof for on-chain submission to ZKFabricVerifier.
 * Returns the uint256[8] proof array and uint256[] publicSignals array.
 */
export function formatProofForChain(zkProof: ZKProof): {
  proof: bigint[];
  publicSignals: bigint[];
} {
  return {
    proof: zkProof.proof,
    publicSignals: zkProof.publicSignals,
  };
}
