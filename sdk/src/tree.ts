import { IMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";
import { MerkleProof, TREE_DEPTH } from "./types";

const ZERO_VALUE = 0n;
const ARITY = 2;

/**
 * Wrapper around @zk-kit/imt for managing the credential Merkle tree.
 */
export class CredentialTree {
  private tree: IMT;

  constructor() {
    this.tree = new IMT(poseidon2, TREE_DEPTH, ZERO_VALUE, ARITY);
  }

  /**
   * Add a credential hash as a leaf.
   * Returns the leaf index.
   */
  addCredential(credentialHash: bigint): number {
    this.tree.insert(credentialHash);
    return this.tree.leaves.length - 1;
  }

  /**
   * Get a Merkle inclusion proof for a leaf at the given index.
   */
  getMerkleProof(leafIndex: number): MerkleProof {
    const proof = this.tree.createProof(leafIndex);
    return {
      root: BigInt(proof.root),
      leaf: BigInt(proof.leaf),
      leafIndex: proof.leafIndex,
      siblings: proof.siblings.map((s: any) =>
        BigInt(Array.isArray(s) ? s[0] : s)
      ),
      pathIndices: proof.pathIndices,
    };
  }

  /**
   * Get the current Merkle root.
   */
  getRoot(): bigint {
    return BigInt(this.tree.root);
  }

  /**
   * Get all leaves in the tree.
   */
  getLeaves(): bigint[] {
    return this.tree.leaves.map((l) => BigInt(l));
  }

  /**
   * Number of leaves in the tree.
   */
  get size(): number {
    return this.tree.leaves.length;
  }

  /**
   * Export tree state for persistence.
   */
  export(): { leaves: string[] } {
    return {
      leaves: this.tree.leaves.map((l) => String(l)),
    };
  }

  /**
   * Import tree state from persistence.
   * Rebuilds the tree by re-inserting all leaves.
   */
  static import(data: { leaves: string[] }): CredentialTree {
    const ct = new CredentialTree();
    for (const leaf of data.leaves) {
      ct.tree.insert(BigInt(leaf));
    }
    return ct;
  }
}
