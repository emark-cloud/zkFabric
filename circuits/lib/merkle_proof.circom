pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Standard binary Merkle inclusion proof.
// Proves that a leaf is in a Merkle tree with a given root.
//
// Uses DualMux to select left/right ordering at each level,
// then Poseidon(2) to hash up the tree.
//
// Parameters:
//   DEPTH - tree depth (number of levels)
//
// Inputs:
//   leaf          - the leaf value to prove membership for
//   pathElements  - sibling nodes along the path (bottom to top)
//   pathIndices   - 0 or 1 at each level (0 = leaf is left child, 1 = leaf is right child)
//
// Output:
//   root - the computed Merkle root
template MerkleProof(DEPTH) {
    signal input leaf;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];
    signal output root;

    // Constrain pathIndices to be binary
    for (var i = 0; i < DEPTH; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
    }

    // Hash up the tree level by level
    component hashers[DEPTH];
    component muxLeft[DEPTH];
    component muxRight[DEPTH];

    signal levelHashes[DEPTH + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < DEPTH; i++) {
        // Select left and right inputs based on pathIndices[i]:
        //   pathIndices[i] == 0: left = current, right = sibling
        //   pathIndices[i] == 1: left = sibling, right = current
        muxLeft[i] = Mux1();
        muxLeft[i].c[0] <== levelHashes[i];
        muxLeft[i].c[1] <== pathElements[i];
        muxLeft[i].s <== pathIndices[i];

        muxRight[i] = Mux1();
        muxRight[i].c[0] <== pathElements[i];
        muxRight[i].c[1] <== levelHashes[i];
        muxRight[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxLeft[i].out;
        hashers[i].inputs[1] <== muxRight[i].out;

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[DEPTH];
}
