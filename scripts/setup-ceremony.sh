#!/usr/bin/env bash
# Groth16 trusted setup for zkFabric circuits.
# Usage: bash scripts/setup-ceremony.sh [circuit_name]
#
# Default circuit: selective_disclosure
# For hello world: bash scripts/setup-ceremony.sh hello_world
set -euo pipefail

SNARKJS="npx snarkjs"

CIRCUIT_NAME="${1:-selective_disclosure}"
BUILD_DIR="circuits/build"
PTAU_FILE="$BUILD_DIR/powersOfTau28_hez_final_14.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"

# Determine source circom file
if [ "$CIRCUIT_NAME" = "hello_world" ]; then
    CIRCOM_FILE="circuits/test/hello_world.circom"
else
    CIRCOM_FILE="circuits/credential/${CIRCUIT_NAME}.circom"
fi

echo "=== zkFabric Trusted Setup ==="
echo "Circuit: $CIRCUIT_NAME"
echo "Source:  $CIRCOM_FILE"
echo ""

mkdir -p "$BUILD_DIR"

# Step 1: Download Powers of Tau (Phase 1) if not present
if [ ! -f "$PTAU_FILE" ]; then
    echo "[1/5] Downloading Hermez Powers of Tau (2^14)..."
    curl -L -o "$PTAU_FILE" "$PTAU_URL"
else
    echo "[1/5] Powers of Tau already downloaded."
fi

# Step 2: Compile the circuit
echo "[2/5] Compiling circuit..."
circom "$CIRCOM_FILE" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR" \
    -l node_modules/circomlib/circuits

$SNARKJS r1cs info "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" 2>&1 || true

# Step 3: Phase 2 ceremony (single contributor — fine for hackathon)
echo "[3/5] Starting Phase 2 ceremony..."
$SNARKJS groth16 setup \
    "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"

$SNARKJS zkey contribute \
    "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey" \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
    --name="zkFabric dev ceremony" \
    -v -e="$(head -c 64 /dev/urandom | xxd -p)"

rm -f "$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"

# Step 4: Export verification key
echo "[4/5] Exporting verification key..."
$SNARKJS zkey export verificationkey \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
    "$BUILD_DIR/verification_key.json"

# Step 5: Export Solidity verifier (only for main circuit)
if [ "$CIRCUIT_NAME" != "hello_world" ]; then
    echo "[5/5] Exporting Solidity verifier..."
    $SNARKJS zkey export solidityverifier \
        "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
        "contracts/core/Groth16Verifier.sol"
    echo "  Generated contracts/core/Groth16Verifier.sol"
else
    echo "[5/5] Skipping Solidity export for hello_world."
fi

echo ""
echo "=== Setup Complete ==="
echo "  WASM:   $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
echo "  zkey:   $BUILD_DIR/${CIRCUIT_NAME}_final.zkey"
echo "  vkey:   $BUILD_DIR/verification_key.json"
