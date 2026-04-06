import { expect } from "chai";
import path from "path";

// snarkjs is CJS — use require
const snarkjs = require("snarkjs");

describe("Hello World Circuit (Poseidon)", function () {
  this.timeout(60_000); // ZK operations can be slow

  const BUILD_DIR = path.join(__dirname, "../../circuits/build");
  const WASM_PATH = path.join(BUILD_DIR, "hello_world_js/hello_world.wasm");
  const ZKEY_PATH = path.join(BUILD_DIR, "hello_world_final.zkey");
  const VKEY_PATH = path.join(BUILD_DIR, "hello_world_vkey.json");

  let vkey: any;

  before(async function () {
    // Load verification key
    vkey = require(VKEY_PATH);
  });

  it("should generate and verify a valid proof", async function () {
    const input = { a: 123, b: 456 };

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    // publicSignals[0] is the Poseidon hash output
    console.log("    Poseidon(123, 456) =", publicSignals[0]);

    // Verify proof
    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    expect(valid).to.be.true;
  });

  it("should produce consistent hashes for the same inputs", async function () {
    const input = { a: 123, b: 456 };

    const { publicSignals: signals1 } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );
    const { publicSignals: signals2 } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    expect(signals1[0]).to.equal(signals2[0]);
  });

  it("should produce different hashes for different inputs", async function () {
    const { publicSignals: signals1 } = await snarkjs.groth16.fullProve(
      { a: 1, b: 2 },
      WASM_PATH,
      ZKEY_PATH
    );
    const { publicSignals: signals2 } = await snarkjs.groth16.fullProve(
      { a: 3, b: 4 },
      WASM_PATH,
      ZKEY_PATH
    );

    expect(signals1[0]).to.not.equal(signals2[0]);
  });

  it("should fail verification with tampered public signals", async function () {
    const input = { a: 100, b: 200 };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_PATH,
      ZKEY_PATH
    );

    // Tamper with the hash output
    const tampered = [...publicSignals];
    tampered[0] = "999999999";

    const valid = await snarkjs.groth16.verify(vkey, tampered, proof);
    expect(valid).to.be.false;
  });
});
