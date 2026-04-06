// Core types
export {
  PredicateType,
  CredentialType,
  TREE_DEPTH,
  NUM_SLOTS,
  SET_SIZE,
} from "./types";
export type {
  Predicate,
  Credential,
  Identity,
  ProofRequest,
  ZKProof,
  MerkleProof,
  CircuitArtifacts,
  ZKFabricConfig,
  SerializedCredential,
  SerializedIdentity,
} from "./types";

// Identity
export {
  generatePrivateKey,
  computeIdentityCommitment,
  createIdentity,
  computeCredentialHash,
  computeNullifier,
} from "./identity";

// Merkle tree
export { CredentialTree } from "./tree";

// Prover
export {
  buildCircuitInput,
  generateProof,
  verifyProof,
  formatProofForChain,
} from "./prover";

// Wallet (user-facing)
export { ZKFabricWallet } from "./ZKFabricWallet";

// Client (dApp-facing)
export { ZKFabric } from "./ZKFabric";

// Adapters
export {
  KYC_SBT_ABI,
  KYC_ADAPTER_ABI,
  KycStatus,
  KycLevel,
  packKycSlots,
} from "./adapters/KYCSBTIngester";
export type { KycInfo } from "./adapters/KYCSBTIngester";

export {
  ZKTLS_ADAPTER_ABI,
  packZktlsSlots,
} from "./adapters/ZKTLSIngester";
export type { ZKTLSAttestation } from "./adapters/ZKTLSIngester";
