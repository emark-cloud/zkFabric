pragma circom 2.1.9;

include "../lib/poseidon_hasher.circom";

// Test wrapper for PoseidonHash1
template TestPoseidonHash1() {
    signal input in;
    signal output out;

    component h = PoseidonHash1();
    h.in <== in;
    out <== h.out;
}

// Test wrapper for PoseidonHash2
template TestPoseidonHash2() {
    signal input in[2];
    signal output out;

    component h = PoseidonHash2();
    h.in[0] <== in[0];
    h.in[1] <== in[1];
    out <== h.out;
}

// Test wrapper for PoseidonHash9
template TestPoseidonHash9() {
    signal input in[9];
    signal output out;

    component h = PoseidonHash9();
    for (var i = 0; i < 9; i++) {
        h.in[i] <== in[i];
    }
    out <== h.out;
}

component main = TestPoseidonHash9();
