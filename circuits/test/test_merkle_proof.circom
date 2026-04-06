pragma circom 2.1.9;

include "../lib/merkle_proof.circom";

// Test with a small tree (depth 3) for fast testing
template TestMerkleProof() {
    signal input leaf;
    signal input pathElements[3];
    signal input pathIndices[3];
    signal output root;

    component mp = MerkleProof(3);
    mp.leaf <== leaf;
    for (var i = 0; i < 3; i++) {
        mp.pathElements[i] <== pathElements[i];
        mp.pathIndices[i] <== pathIndices[i];
    }
    root <== mp.root;
}

component main = TestMerkleProof();
