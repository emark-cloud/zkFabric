pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon hash of 2 inputs — used for Merkle tree nodes and nullifier
template PoseidonHash2() {
    signal input in[2];
    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== in[0];
    hasher.inputs[1] <== in[1];

    out <== hasher.out;
}

// Poseidon hash of 1 input — used for identity commitment: Poseidon(privateKey)
template PoseidonHash1() {
    signal input in;
    signal output out;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== in;

    out <== hasher.out;
}

// Poseidon hash of 9 inputs — used for credential commitment:
// credentialHash = Poseidon(identityCommitment, slot[0], ..., slot[7])
//
// Circomlib's Poseidon supports up to 16 inputs natively.
template PoseidonHash9() {
    signal input in[9];
    signal output out;

    component hasher = Poseidon(9);
    for (var i = 0; i < 9; i++) {
        hasher.inputs[i] <== in[i];
    }

    out <== hasher.out;
}
