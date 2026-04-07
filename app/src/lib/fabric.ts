import {
  createIdentity,
  computeCredentialHash,
  computeNullifier,
  computeIdentityCommitment,
  generateMnemonic12,
  identityFromMnemonic,
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
  generateMnemonic12,
  identityFromMnemonic,
  CredentialTree,
  buildCircuitInput,
  packKycSlots,
  packZktlsSlots,
  PredicateType,
  CredentialType,
  NUM_SLOTS,
  SET_SIZE,
};

// Public indexer URL — frontend reads from this to rebuild the credential tree
// without trusting localStorage. Override with NEXT_PUBLIC_INDEXER_URL.
export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8787";
export type { Identity, Credential, MerkleProof, Predicate, KycInfo, ZKTLSAttestation };

// Circuit artifact paths (relative to public/)
export const WASM_PATH = "/circuits/selective_disclosure.wasm";
export const ZKEY_PATH = "/circuits/selective_disclosure_final.zkey";

// Local storage keys
const STORAGE_KEY_IDENTITY = "zkfabric_identity";
const STORAGE_KEY_MNEMONIC = "zkfabric_mnemonic";
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
  localStorage.removeItem(STORAGE_KEY_MNEMONIC);
  localStorage.removeItem(STORAGE_KEY_CREDENTIALS);
  localStorage.removeItem(STORAGE_KEY_TREE);
  localStorage.removeItem(STORAGE_KEY_LEAF_INDICES);
}

// ============================================================================
// Recoverable identity (BIP39 mnemonic)
// ============================================================================

/**
 * Persist a mnemonic so the user can recover their identity on another device.
 * The mnemonic is the source of truth — `Identity` is derived from it.
 */
export function saveMnemonic(mnemonic: string): void {
  localStorage.setItem(STORAGE_KEY_MNEMONIC, mnemonic);
}

export function loadMnemonic(): string | null {
  return localStorage.getItem(STORAGE_KEY_MNEMONIC);
}

/**
 * Get an existing mnemonic-backed identity, or generate a new mnemonic + identity
 * on first use. Returns both so the caller can show the mnemonic to the user
 * the very first time it's created (and only then) for backup.
 */
export function loadOrCreateMnemonicIdentity(): {
  identity: Identity;
  mnemonic: string;
  isNew: boolean;
} {
  const existing = loadMnemonic();
  if (existing) {
    const identity = identityFromMnemonic(existing);
    saveIdentity(identity);
    return { identity, mnemonic: existing, isNew: false };
  }
  const mnemonic = generateMnemonic12();
  const identity = identityFromMnemonic(mnemonic);
  saveMnemonic(mnemonic);
  saveIdentity(identity);
  return { identity, mnemonic, isNew: true };
}

/**
 * Restore an identity from a user-provided mnemonic (recovery flow).
 * Replaces any existing local mnemonic + identity.
 */
export function restoreFromMnemonic(mnemonic: string): Identity {
  const identity = identityFromMnemonic(mnemonic.trim());
  saveMnemonic(mnemonic.trim());
  saveIdentity(identity);
  return identity;
}

// ============================================================================
// Indexer-backed tree sync
// ============================================================================

/**
 * Rebuild the credential Merkle tree from the on-chain event log via the
 * zkFabric indexer. This is the recoverable source of truth — losing
 * localStorage is no longer fatal because the tree can always be replayed.
 *
 * Falls back to the locally cached tree if the indexer is unreachable so
 * existing demos keep working in offline / dev environments.
 */
export async function syncTreeFromIndexer(
  baseUrl: string = INDEXER_URL
): Promise<CredentialTree> {
  try {
    const tree = await CredentialTree.fromIndexer(baseUrl);
    saveTree(tree);
    return tree;
  } catch (err) {
    console.warn(
      `[fabric] indexer sync failed (${baseUrl}), using local cache:`,
      err
    );
    const cached = loadTree();
    if (cached) return cached;
    // Final fallback: empty tree.
    return new CredentialTree();
  }
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
