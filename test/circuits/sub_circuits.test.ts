import { expect } from "chai";
import path from "path";
const snarkjs = require("snarkjs");

// We use poseidon-lite for off-chain reference hashes
import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";

const BUILD = path.join(__dirname, "../../circuits/build");

function artifactsFor(name: string) {
  return {
    wasm: path.join(BUILD, `${name}_js/${name}.wasm`),
    zkey: path.join(BUILD, `${name}_final.zkey`),
    vkey: require(path.join(BUILD, `${name}_vkey.json`)),
  };
}

async function proveAndVerify(
  name: string,
  input: any
): Promise<{ publicSignals: string[]; valid: boolean }> {
  const { wasm, zkey, vkey } = artifactsFor(name);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasm,
    zkey
  );
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  return { publicSignals, valid };
}

// ============================================================
// Poseidon Hasher Tests
// ============================================================
describe("PoseidonHash9 Sub-circuit", function () {
  this.timeout(30_000);

  it("should match poseidon-lite reference for 9 inputs", async function () {
    const inputs = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n];
    const expected = poseidon9(inputs);

    const { publicSignals, valid } = await proveAndVerify(
      "test_poseidon_hasher",
      { in: inputs.map(String) }
    );

    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal(expected.toString());
  });

  it("should produce different hash for different inputs", async function () {
    const { publicSignals: s1 } = await proveAndVerify(
      "test_poseidon_hasher",
      { in: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] }
    );
    const { publicSignals: s2 } = await proveAndVerify(
      "test_poseidon_hasher",
      { in: ["9", "8", "7", "6", "5", "4", "3", "2", "1"] }
    );

    expect(s1[0]).to.not.equal(s2[0]);
  });
});

// ============================================================
// Merkle Proof Tests (depth 3)
// ============================================================
describe("MerkleProof Sub-circuit (depth 3)", function () {
  this.timeout(30_000);

  // Build a depth-3 tree manually using poseidon2
  // Tree with 8 leaves, we prove leaf 0 (leftmost)
  function buildTree(leaves: bigint[]) {
    // Pad to 8 leaves
    while (leaves.length < 8) leaves.push(0n);

    // Level 0 → 1 (4 nodes)
    const level1 = [];
    for (let i = 0; i < 4; i++) {
      level1.push(poseidon2([leaves[i * 2], leaves[i * 2 + 1]]));
    }
    // Level 1 → 2 (2 nodes)
    const level2 = [];
    for (let i = 0; i < 2; i++) {
      level2.push(poseidon2([level1[i * 2], level1[i * 2 + 1]]));
    }
    // Root
    const root = poseidon2([level2[0], level2[1]]);

    return { leaves, level1, level2, root };
  }

  it("should verify a valid Merkle proof for leaf 0", async function () {
    const tree = buildTree([10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n]);

    // Proof for leaf 0 (index 0b000): siblings at each level
    const pathElements = [
      tree.leaves[1],  // sibling at level 0
      tree.level1[1],  // sibling at level 1
      tree.level2[1],  // sibling at level 2
    ];
    const pathIndices = [0, 0, 0]; // leaf 0 is always left child

    const { publicSignals, valid } = await proveAndVerify(
      "test_merkle_proof",
      {
        leaf: tree.leaves[0].toString(),
        pathElements: pathElements.map(String),
        pathIndices: pathIndices.map(String),
      }
    );

    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal(tree.root.toString());
  });

  it("should verify a valid Merkle proof for leaf 5", async function () {
    const tree = buildTree([10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n]);

    // Leaf 5 = index 0b101: right at level 0, left at level 1, right at level 2
    const pathElements = [
      tree.leaves[4],  // sibling at level 0 (leaf 4)
      tree.level1[3],  // sibling at level 1
      tree.level2[0],  // sibling at level 2
    ];
    const pathIndices = [1, 0, 1]; // 5 = 101 in binary

    const { publicSignals, valid } = await proveAndVerify(
      "test_merkle_proof",
      {
        leaf: tree.leaves[5].toString(),
        pathElements: pathElements.map(String),
        pathIndices: pathIndices.map(String),
      }
    );

    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal(tree.root.toString());
  });

  it("should fail with wrong leaf value", async function () {
    const tree = buildTree([10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n]);

    const pathElements = [
      tree.leaves[1],
      tree.level1[1],
      tree.level2[1],
    ];

    const { publicSignals, valid } = await proveAndVerify(
      "test_merkle_proof",
      {
        leaf: "999", // wrong leaf
        pathElements: pathElements.map(String),
        pathIndices: ["0", "0", "0"],
      }
    );

    // Proof is valid but root won't match the expected root
    expect(valid).to.be.true; // proof itself is valid
    expect(publicSignals[0]).to.not.equal(tree.root.toString()); // but root is different
  });
});

// ============================================================
// Predicate Evaluator Tests
// ============================================================
describe("PredicateEvaluator Sub-circuit", function () {
  this.timeout(30_000);

  const zeroPadSet = (vals: string[]) => {
    const padded = [...vals];
    while (padded.length < 4) padded.push("0");
    return padded;
  };

  it("NONE (type 0): should always pass", async function () {
    const { publicSignals, valid } = await proveAndVerify(
      "test_predicates",
      {
        slotValue: "42",
        predicateType: "0",
        predicateValue: "0",
        predicateSet: zeroPadSet([]),
      }
    );
    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal("1"); // pass
  });

  it("EQUALS (type 1): should pass when equal", async function () {
    const { publicSignals, valid } = await proveAndVerify(
      "test_predicates",
      {
        slotValue: "3",
        predicateType: "1",
        predicateValue: "3",
        predicateSet: zeroPadSet([]),
      }
    );
    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal("1");
  });

  it("EQUALS (type 1): should fail when not equal", async function () {
    const { publicSignals, valid } = await proveAndVerify(
      "test_predicates",
      {
        slotValue: "3",
        predicateType: "1",
        predicateValue: "5",
        predicateSet: zeroPadSet([]),
      }
    );
    expect(valid).to.be.true;
    expect(publicSignals[0]).to.equal("0"); // fail
  });

  it("GREATER_EQUAL (type 2): should pass when >=", async function () {
    // Equal case
    const { publicSignals: s1 } = await proveAndVerify("test_predicates", {
      slotValue: "3",
      predicateType: "2",
      predicateValue: "3",
      predicateSet: zeroPadSet([]),
    });
    expect(s1[0]).to.equal("1");

    // Greater case
    const { publicSignals: s2 } = await proveAndVerify("test_predicates", {
      slotValue: "5",
      predicateType: "2",
      predicateValue: "3",
      predicateSet: zeroPadSet([]),
    });
    expect(s2[0]).to.equal("1");
  });

  it("GREATER_EQUAL (type 2): should fail when <", async function () {
    const { publicSignals } = await proveAndVerify("test_predicates", {
      slotValue: "2",
      predicateType: "2",
      predicateValue: "3",
      predicateSet: zeroPadSet([]),
    });
    expect(publicSignals[0]).to.equal("0");
  });

  it("LESS_THAN (type 3): should pass when <", async function () {
    const { publicSignals } = await proveAndVerify("test_predicates", {
      slotValue: "2",
      predicateType: "3",
      predicateValue: "5",
      predicateSet: zeroPadSet([]),
    });
    expect(publicSignals[0]).to.equal("1");
  });

  it("LESS_THAN (type 3): should fail when >=", async function () {
    const { publicSignals: s1 } = await proveAndVerify("test_predicates", {
      slotValue: "5",
      predicateType: "3",
      predicateValue: "5",
      predicateSet: zeroPadSet([]),
    });
    expect(s1[0]).to.equal("0");

    const { publicSignals: s2 } = await proveAndVerify("test_predicates", {
      slotValue: "6",
      predicateType: "3",
      predicateValue: "5",
      predicateSet: zeroPadSet([]),
    });
    expect(s2[0]).to.equal("0");
  });

  it("IN_SET (type 4): should pass when value in set", async function () {
    const { publicSignals } = await proveAndVerify("test_predicates", {
      slotValue: "344",
      predicateType: "4",
      predicateValue: "0",
      predicateSet: ["344", "840", "826", "0"],
    });
    expect(publicSignals[0]).to.equal("1");
  });

  it("IN_SET (type 4): should fail when value not in set", async function () {
    const { publicSignals } = await proveAndVerify("test_predicates", {
      slotValue: "999",
      predicateType: "4",
      predicateValue: "0",
      predicateSet: ["344", "840", "826", "0"],
    });
    expect(publicSignals[0]).to.equal("0");
  });
});
