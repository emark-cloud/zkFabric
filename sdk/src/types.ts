// ================================================================
// Core types for the zkFabric SDK
// ================================================================

/** Predicate types matching the circuit encoding (0-4) */
export enum PredicateType {
  NONE = 0,
  EQUALS = 1,
  GREATER_EQUAL = 2,
  LESS_THAN = 3,
  IN_SET = 4,
}

/** Credential type identifiers */
export enum CredentialType {
  KYC_SBT = 1,
  ZKTLS = 2,
  ON_CHAIN = 3,
}

/** A single predicate constraint on a credential slot */
export interface Predicate {
  slot: number; // 0-7
  op: PredicateType;
  value: bigint; // threshold for EQUALS/GREATER_EQUAL/LESS_THAN
  set?: bigint[]; // values for IN_SET (max 4)
}

/** A stored credential with its private data */
export interface Credential {
  id: string;
  type: CredentialType;
  identityCommitment: bigint;
  credentialHash: bigint;
  slots: bigint[]; // 8 slot values
  createdAt: number;
}

/** User identity (private key + derived values) */
export interface Identity {
  privateKey: bigint;
  commitment: bigint;
}

/** A proof request from a dApp */
export interface ProofRequest {
  scope: bigint;
  predicates: Predicate[];
}

/** A generated ZK proof ready for on-chain submission */
export interface ZKProof {
  /** Groth16 proof elements [a0, a1, b00, b01, b10, b11, c0, c1] */
  proof: bigint[];
  /** All 52 public signals */
  publicSignals: bigint[];
  /** The nullifier hash (for convenience) */
  nullifierHash: bigint;
  /** The Merkle root used */
  merkleRoot: bigint;
}

/** Serialized format for localStorage persistence */
export interface SerializedCredential {
  id: string;
  type: number;
  identityCommitment: string;
  credentialHash: string;
  slots: string[];
  createdAt: number;
}

/** Serialized identity */
export interface SerializedIdentity {
  privateKey: string;
  commitment: string;
}

/** Circuit artifact paths */
export interface CircuitArtifacts {
  wasmPath: string;
  zkeyPath: string;
  vkeyPath?: string;
}

/** SDK configuration */
export interface ZKFabricConfig {
  chainId: number;
  rpcUrl: string;
  registryAddress: string;
  verifierAddress: string;
  artifacts: CircuitArtifacts;
}

/** Merkle proof from the tree */
export interface MerkleProof {
  root: bigint;
  leaf: bigint;
  leafIndex: number;
  siblings: bigint[];
  pathIndices: number[];
}

/** Constants */
export const TREE_DEPTH = 20;
export const NUM_SLOTS = 8;
export const SET_SIZE = 4;
