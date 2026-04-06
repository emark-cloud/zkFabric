import {
  Identity,
  Credential,
  CredentialType,
  ProofRequest,
  ZKProof,
  CircuitArtifacts,
  SerializedCredential,
  SerializedIdentity,
  NUM_SLOTS,
} from "./types";
import {
  createIdentity,
  computeCredentialHash,
  computeIdentityCommitment,
} from "./identity";
import { CredentialTree } from "./tree";
import { generateProof } from "./prover";

/**
 * ZKFabricWallet manages a user's identity, credentials, and Merkle tree.
 * This is the user-facing SDK component.
 */
export class ZKFabricWallet {
  private identity: Identity;
  private credentials: Map<string, Credential> = new Map();
  private tree: CredentialTree;
  private leafIndices: Map<string, number> = new Map(); // credentialId -> leafIndex
  private artifacts: CircuitArtifacts;

  constructor(artifacts: CircuitArtifacts, privateKey?: bigint) {
    this.identity = createIdentity(privateKey);
    this.tree = new CredentialTree();
    this.artifacts = artifacts;
  }

  /**
   * Get the identity commitment (public).
   */
  getCommitment(): bigint {
    return this.identity.commitment;
  }

  /**
   * Get the private key (for signing / proof generation).
   */
  getPrivateKey(): bigint {
    return this.identity.privateKey;
  }

  /**
   * Store a credential from ingested data (8 slot values).
   * Adds to the Merkle tree and returns the credential ID.
   */
  addCredential(
    id: string,
    type: CredentialType,
    slots: bigint[]
  ): Credential {
    if (slots.length !== NUM_SLOTS) {
      throw new Error(`Expected ${NUM_SLOTS} slots, got ${slots.length}`);
    }

    const credentialHash = computeCredentialHash(
      this.identity.commitment,
      slots
    );

    const credential: Credential = {
      id,
      type,
      identityCommitment: this.identity.commitment,
      credentialHash,
      slots,
      createdAt: Date.now(),
    };

    this.credentials.set(id, credential);
    const leafIndex = this.tree.addCredential(credentialHash);
    this.leafIndices.set(id, leafIndex);

    return credential;
  }

  /**
   * Get a credential by ID.
   */
  getCredential(id: string): Credential | undefined {
    return this.credentials.get(id);
  }

  /**
   * Get all credentials.
   */
  getAllCredentials(): Credential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Generate a ZK proof for a credential.
   */
  async generateProof(
    credentialId: string,
    request: ProofRequest
  ): Promise<ZKProof> {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const leafIndex = this.leafIndices.get(credentialId);
    if (leafIndex === undefined) {
      throw new Error(`Leaf index not found for credential: ${credentialId}`);
    }

    const merkleProof = this.tree.getMerkleProof(leafIndex);

    return generateProof(
      this.identity.privateKey,
      credential.slots,
      merkleProof,
      request,
      this.artifacts
    );
  }

  /**
   * Get the current Merkle root.
   */
  getMerkleRoot(): bigint {
    return this.tree.getRoot();
  }

  /**
   * Export wallet state for persistence (e.g., localStorage).
   */
  export(): {
    identity: SerializedIdentity;
    credentials: SerializedCredential[];
    tree: { leaves: string[] };
    leafIndices: [string, number][];
  } {
    const serializedCreds: SerializedCredential[] = [];
    for (const cred of this.credentials.values()) {
      serializedCreds.push({
        id: cred.id,
        type: cred.type,
        identityCommitment: cred.identityCommitment.toString(),
        credentialHash: cred.credentialHash.toString(),
        slots: cred.slots.map(String),
        createdAt: cred.createdAt,
      });
    }

    return {
      identity: {
        privateKey: this.identity.privateKey.toString(),
        commitment: this.identity.commitment.toString(),
      },
      credentials: serializedCreds,
      tree: this.tree.export(),
      leafIndices: Array.from(this.leafIndices.entries()),
    };
  }

  /**
   * Restore wallet from exported state.
   */
  static import(
    data: {
      identity: SerializedIdentity;
      credentials: SerializedCredential[];
      tree: { leaves: string[] };
      leafIndices: [string, number][];
    },
    artifacts: CircuitArtifacts
  ): ZKFabricWallet {
    const privateKey = BigInt(data.identity.privateKey);
    const wallet = new ZKFabricWallet(artifacts, privateKey);

    // Restore tree
    wallet.tree = CredentialTree.import(data.tree);

    // Restore credentials
    for (const sc of data.credentials) {
      const cred: Credential = {
        id: sc.id,
        type: sc.type as CredentialType,
        identityCommitment: BigInt(sc.identityCommitment),
        credentialHash: BigInt(sc.credentialHash),
        slots: sc.slots.map(BigInt),
        createdAt: sc.createdAt,
      };
      wallet.credentials.set(cred.id, cred);
    }

    // Restore leaf indices
    for (const [id, idx] of data.leafIndices) {
      wallet.leafIndices.set(id, idx);
    }

    return wallet;
  }
}
