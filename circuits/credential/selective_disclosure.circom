pragma circom 2.1.9;

include "../lib/poseidon_hasher.circom";
include "../lib/merkle_proof.circom";
include "../lib/predicates.circom";

// SelectiveDisclosure — Main zkFabric circuit.
//
// Proves ALL of the following without revealing identity or raw credential data:
//   1. Identity ownership:  identityCommitment = Poseidon(privateKey)
//   2. Credential binding:  credentialHash = Poseidon(identityCommitment, slot[0..7])
//   3. Merkle membership:   credentialHash is a leaf in the tree with the given root
//   4. Nullifier correctness: nullifierHash = Poseidon(privateKey, scope)
//   5. Predicate satisfaction: all slot predicates pass
//
// Parameters:
//   TREE_DEPTH - Merkle tree depth (20)
//   NUM_SLOTS  - number of credential data slots (8)
//   SET_SIZE   - max elements per IN_SET predicate (4)
//
// Constraint budget (~10K, fits ptau 2^14):
//   Poseidon(1) identity:     ~240
//   Poseidon(9) credential:   ~417
//   MerkleProof(20):         ~4,860
//   Poseidon(2) nullifier:    ~240
//   8x PredicateEvaluator:   ~4,256
//   Total:                   ~10,013
template SelectiveDisclosure(TREE_DEPTH, NUM_SLOTS, SET_SIZE) {
    // ---- Private inputs ----
    signal input privateKey;
    signal input credentialData[NUM_SLOTS];          // slot values
    signal input merkleSiblings[TREE_DEPTH];         // Merkle proof path elements
    signal input merklePathIndices[TREE_DEPTH];      // Merkle proof path directions

    // ---- Public inputs ----
    signal input merkleRoot;                         // current tree root
    signal input nullifierHash;                      // Poseidon(privateKey, scope)
    signal input scope;                              // dApp identifier
    signal input predicateTypes[NUM_SLOTS];          // predicate type per slot (0-4)
    signal input predicateValues[NUM_SLOTS];         // threshold per slot
    signal input predicateSets[NUM_SLOTS][SET_SIZE]; // set values per slot

    // ---- Output ----
    signal output allPredicatesPass;                 // 1 if all predicates satisfied

    // ================================================================
    // Step 1: Identity ownership
    // identityCommitment = Poseidon(privateKey)
    // ================================================================
    component identityHasher = PoseidonHash1();
    identityHasher.in <== privateKey;
    signal identityCommitment;
    identityCommitment <== identityHasher.out;

    // ================================================================
    // Step 2: Credential binding
    // credentialHash = Poseidon(identityCommitment, slot[0], ..., slot[7])
    // ================================================================
    component credentialHasher = PoseidonHash9();
    credentialHasher.in[0] <== identityCommitment;
    for (var i = 0; i < NUM_SLOTS; i++) {
        credentialHasher.in[i + 1] <== credentialData[i];
    }
    signal credentialHash;
    credentialHash <== credentialHasher.out;

    // ================================================================
    // Step 3: Merkle membership
    // Prove credentialHash is in the tree
    // ================================================================
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== credentialHash;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.pathElements[i] <== merkleSiblings[i];
        merkle.pathIndices[i] <== merklePathIndices[i];
    }
    // Constrain: computed root must equal the provided public root
    merkle.root === merkleRoot;

    // ================================================================
    // Step 4: Nullifier correctness
    // nullifierHash = Poseidon(privateKey, scope)
    // Unique per user per scope, prevents double-use
    // ================================================================
    component nullifierHasher = PoseidonHash2();
    nullifierHasher.in[0] <== privateKey;
    nullifierHasher.in[1] <== scope;
    // Constrain: computed nullifier must equal the provided public nullifier
    nullifierHasher.out === nullifierHash;

    // ================================================================
    // Step 5: Predicate satisfaction
    // Each slot is evaluated against its predicate; all must pass
    // ================================================================
    component predicateChecker = PredicateChecker(NUM_SLOTS, SET_SIZE, 252);
    for (var i = 0; i < NUM_SLOTS; i++) {
        predicateChecker.slotValues[i] <== credentialData[i];
        predicateChecker.predicateTypes[i] <== predicateTypes[i];
        predicateChecker.predicateValues[i] <== predicateValues[i];
        for (var j = 0; j < SET_SIZE; j++) {
            predicateChecker.predicateSets[i][j] <== predicateSets[i][j];
        }
    }

    // Constrain: all predicates must pass (allPass == 1)
    predicateChecker.allPass === 1;
    allPredicatesPass <== predicateChecker.allPass;
}

// Instantiate with production parameters
component main {public [
    merkleRoot,
    nullifierHash,
    scope,
    predicateTypes,
    predicateValues,
    predicateSets
]} = SelectiveDisclosure(20, 8, 4);
