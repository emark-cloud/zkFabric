pragma circom 2.1.9;

include "../lib/predicates.circom";

// Test a single predicate evaluator with SET_SIZE=4, BIT_SIZE=252
template TestPredicateEvaluator() {
    signal input slotValue;
    signal input predicateType;
    signal input predicateValue;
    signal input predicateSet[4];
    signal output out;

    component pe = PredicateEvaluator(4, 252);
    pe.slotValue <== slotValue;
    pe.predicateType <== predicateType;
    pe.predicateValue <== predicateValue;
    for (var i = 0; i < 4; i++) {
        pe.predicateSet[i] <== predicateSet[i];
    }
    out <== pe.out;
}

component main = TestPredicateEvaluator();
