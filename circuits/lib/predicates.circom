pragma circom 2.1.9;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Predicate type constants (encoded as integers in circuit inputs):
//   0 = NONE          — no constraint, always passes
//   1 = EQUALS        — slot == value
//   2 = GREATER_EQUAL — slot >= value
//   3 = LESS_THAN     — slot < value
//   4 = IN_SET        — slot ∈ {set[0], set[1], ..., set[SET_SIZE-1]}

// Evaluates a single predicate on a slot value.
//
// Parameters:
//   SET_SIZE - max number of elements for IN_SET predicate
//   BIT_SIZE - bit width for comparisons (252 fits in BN128 field)
//
// Inputs:
//   slotValue      - the credential slot value to evaluate
//   predicateType  - which predicate to apply (0-4)
//   predicateValue - threshold/comparison value (used by EQUALS, GREATER_EQUAL, LESS_THAN)
//   predicateSet   - set of values for IN_SET
//
// Output:
//   out - 1 if predicate passes, 0 if it fails
//
// The circuit computes all predicate results, then selects the correct one
// based on predicateType. This avoids conditional logic (not allowed in circom).
template PredicateEvaluator(SET_SIZE, BIT_SIZE) {
    signal input slotValue;
    signal input predicateType;
    signal input predicateValue;
    signal input predicateSet[SET_SIZE];
    signal output out;

    // --- Compute each predicate result independently ---

    // NONE: always 1
    signal resultNone;
    resultNone <== 1;

    // EQUALS: slotValue == predicateValue
    component isEq = IsEqual();
    isEq.in[0] <== slotValue;
    isEq.in[1] <== predicateValue;
    signal resultEquals;
    resultEquals <== isEq.out;

    // GREATER_EQUAL: slotValue >= predicateValue
    // i.e., NOT(slotValue < predicateValue)
    component ltForGe = LessThan(BIT_SIZE);
    ltForGe.in[0] <== slotValue;
    ltForGe.in[1] <== predicateValue;
    signal resultGreaterEqual;
    resultGreaterEqual <== 1 - ltForGe.out;

    // LESS_THAN: slotValue < predicateValue
    component lt = LessThan(BIT_SIZE);
    lt.in[0] <== slotValue;
    lt.in[1] <== predicateValue;
    signal resultLessThan;
    resultLessThan <== lt.out;

    // IN_SET: slotValue ∈ predicateSet
    // Check if slotValue equals any element in the set.
    // matchCount = number of matches (0 or more)
    // Result = 1 if matchCount > 0
    component setEq[SET_SIZE];
    signal matchAccum[SET_SIZE + 1];
    matchAccum[0] <== 0;
    for (var i = 0; i < SET_SIZE; i++) {
        setEq[i] = IsEqual();
        setEq[i].in[0] <== slotValue;
        setEq[i].in[1] <== predicateSet[i];
        matchAccum[i + 1] <== matchAccum[i] + setEq[i].out;
    }
    // matchAccum[SET_SIZE] is the total number of matches (0..SET_SIZE)
    // We need: isNonZero(matchAccum[SET_SIZE])
    component matchIsZero = IsZero();
    matchIsZero.in <== matchAccum[SET_SIZE];
    signal resultInSet;
    resultInSet <== 1 - matchIsZero.out;

    // --- Select the correct result based on predicateType ---
    // We use a chain of IsEqual checks + accumulator to multiplex.
    // This avoids needing a Mux with >2 inputs.

    // Check which type is active
    component isType[5];
    for (var i = 0; i < 5; i++) {
        isType[i] = IsEqual();
        isType[i].in[0] <== predicateType;
        isType[i].in[1] <== i;
    }

    // Weighted sum: exactly one isType[i].out is 1, rest are 0
    // out = isType[0]*resultNone + isType[1]*resultEquals + ...
    signal term[5];
    term[0] <== isType[0].out * resultNone;
    term[1] <== isType[1].out * resultEquals;
    term[2] <== isType[2].out * resultGreaterEqual;
    term[3] <== isType[3].out * resultLessThan;
    term[4] <== isType[4].out * resultInSet;

    out <== term[0] + term[1] + term[2] + term[3] + term[4];
}

// Evaluates predicates for all 8 credential slots.
// All predicates must pass (AND logic).
//
// Parameters:
//   NUM_SLOTS - number of credential slots (8)
//   SET_SIZE  - max set size for IN_SET predicates (4)
//   BIT_SIZE  - bit width for comparisons (252)
//
// Output:
//   allPass - 1 if ALL predicates pass, 0 otherwise
template PredicateChecker(NUM_SLOTS, SET_SIZE, BIT_SIZE) {
    signal input slotValues[NUM_SLOTS];
    signal input predicateTypes[NUM_SLOTS];
    signal input predicateValues[NUM_SLOTS];
    signal input predicateSets[NUM_SLOTS][SET_SIZE];
    signal output allPass;

    component evaluators[NUM_SLOTS];
    signal passAccum[NUM_SLOTS + 1];
    passAccum[0] <== 1;

    for (var i = 0; i < NUM_SLOTS; i++) {
        evaluators[i] = PredicateEvaluator(SET_SIZE, BIT_SIZE);
        evaluators[i].slotValue <== slotValues[i];
        evaluators[i].predicateType <== predicateTypes[i];
        evaluators[i].predicateValue <== predicateValues[i];
        for (var j = 0; j < SET_SIZE; j++) {
            evaluators[i].predicateSet[j] <== predicateSets[i][j];
        }
        // AND chain: passAccum stays 1 only if every evaluator outputs 1
        passAccum[i + 1] <== passAccum[i] * evaluators[i].out;
    }

    allPass <== passAccum[NUM_SLOTS];
}
