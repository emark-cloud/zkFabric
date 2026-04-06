pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Hello World circuit: proves knowledge of two secret inputs whose Poseidon hash
// equals a public output. This exercises the full ZK pipeline:
// compile -> trusted setup -> prove -> verify
template HelloPoseidon() {
    signal input a;
    signal input b;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== a;
    hasher.inputs[1] <== b;

    hash <== hasher.out;
}

component main = HelloPoseidon();
