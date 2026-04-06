import {
  createIdentity,
  computeCredentialHash,
  computeNullifier,
  computeIdentityCommitment,
} from "../../../sdk/src/identity";
import { CredentialTree } from "../../../sdk/src/tree";
import { buildCircuitInput } from "../../../sdk/src/prover";
import { packKycSlots, type KycInfo } from "../../../sdk/src/adapters/KYCSBTIngester";
import { packZktlsSlots, type ZKTLSAttestation } from "../../../sdk/src/adapters/ZKTLSIngester";
import {
  type Identity,
  type Credential,
  type MerkleProof,
  type Predicate,
  CredentialType,
  PredicateType,
  NUM_SLOTS,
  SET_SIZE,
} from "../../../sdk/src/types";

// Re-export for convenience
export {
  createIdentity,
  computeCredentialHash,
  computeNullifier,
  computeIdentityCommitment,
  CredentialTree,
  buildCircuitInput,
  packKycSlots,
  packZktlsSlots,
  PredicateType,
  CredentialType,
  NUM_SLOTS,
  SET_SIZE,
};
export type { Identity, Credential, MerkleProof, Predicate, KycInfo, ZKTLSAttestation };

// Circuit artifact paths (relative to public/)
export const WASM_PATH = "/circuits/selective_disclosure.wasm";
export const ZKEY_PATH = "/circuits/selective_disclosure_final.zkey";

// Local storage keys
const STORAGE_KEY_IDENTITY = "zkfabric_identity";
const STORAGE_KEY_CREDENTIALS = "zkfabric_credentials";
const STORAGE_KEY_TREE = "zkfabric_tree";
const STORAGE_KEY_LEAF_INDICES = "zkfabric_leaf_indices";

/**
 * Save identity to localStorage.
 */
export function saveIdentity(identity: Identity): void {
  localStorage.setItem(
    STORAGE_KEY_IDENTITY,
    JSON.stringify({
      privateKey: identity.privateKey.toString(),
      commitment: identity.commitment.toString(),
    })
  );
}

/**
 * Load identity from localStorage.
 */
export function loadIdentity(): Identity | null {
  const raw = localStorage.getItem(STORAGE_KEY_IDENTITY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  return {
    privateKey: BigInt(data.privateKey),
    commitment: BigInt(data.commitment),
  };
}

/**
 * Save credentials to localStorage.
 */
export function saveCredentials(credentials: Credential[]): void {
  const serialized = credentials.map((c) => ({
    id: c.id,
    type: c.type,
    identityCommitment: c.identityCommitment.toString(),
    credentialHash: c.credentialHash.toString(),
    slots: c.slots.map(String),
    createdAt: c.createdAt,
  }));
  localStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(serialized));
}

/**
 * Load credentials from localStorage.
 */
export function loadCredentials(): Credential[] {
  const raw = localStorage.getItem(STORAGE_KEY_CREDENTIALS);
  if (!raw) return [];
  const data = JSON.parse(raw);
  return data.map((c: any) => ({
    id: c.id,
    type: c.type,
    identityCommitment: BigInt(c.identityCommitment),
    credentialHash: BigInt(c.credentialHash),
    slots: c.slots.map(BigInt),
    createdAt: c.createdAt,
  }));
}

/**
 * Save tree leaves to localStorage.
 */
export function saveTree(tree: CredentialTree): void {
  localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify(tree.export()));
}

/**
 * Load tree from localStorage.
 */
export function loadTree(): CredentialTree | null {
  const raw = localStorage.getItem(STORAGE_KEY_TREE);
  if (!raw) return null;
  return CredentialTree.import(JSON.parse(raw));
}

/**
 * Save leaf index mapping.
 */
export function saveLeafIndices(indices: Map<string, number>): void {
  localStorage.setItem(
    STORAGE_KEY_LEAF_INDICES,
    JSON.stringify(Array.from(indices.entries()))
  );
}

/**
 * Load leaf index mapping.
 */
export function loadLeafIndices(): Map<string, number> {
  const raw = localStorage.getItem(STORAGE_KEY_LEAF_INDICES);
  if (!raw) return new Map();
  return new Map(JSON.parse(raw));
}

/**
 * Clear all stored state.
 */
export function clearAll(): void {
  localStorage.removeItem(STORAGE_KEY_IDENTITY);
  localStorage.removeItem(STORAGE_KEY_CREDENTIALS);
  localStorage.removeItem(STORAGE_KEY_TREE);
  localStorage.removeItem(STORAGE_KEY_LEAF_INDICES);
}

/**
 * Generate a ZK proof in the browser using snarkjs.
 * snarkjs is loaded dynamically to avoid SSR issues.
 */
export async function generateProofInBrowser(
  privateKey: bigint,
  credentialSlots: bigint[],
  merkleProof: MerkleProof,
  scope: bigint,
  predicates: Predicate[]
): Promise<{ proof: bigint[]; publicSignals: bigint[] }> {
  const input = buildCircuitInput(
    privateKey,
    credentialSlots,
    merkleProof,
    scope,
    predicates
  );

  // Dynamic import snarkjs for browser
  const snarkjs = await import("snarkjs");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  // pi_b elements swapped within each G2 point for Solidity verifier
  const proofArray: bigint[] = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]),
    BigInt(proof.pi_b[0][0]),
    BigInt(proof.pi_b[1][1]),
    BigInt(proof.pi_b[1][0]),
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];

  return {
    proof: proofArray,
    publicSignals: publicSignals.map(BigInt),
  };
}
