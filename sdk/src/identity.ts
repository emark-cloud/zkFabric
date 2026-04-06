import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { Identity, NUM_SLOTS } from "./types";

/**
 * Generate a random private key (field element).
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generatePrivateKey(): bigint {
  const bytes = new Uint8Array(31); // 31 bytes to stay within BN128 field
  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    const { randomBytes } = require("crypto");
    const buf = randomBytes(31);
    bytes.set(buf);
  }
  let key = 0n;
  for (const b of bytes) {
    key = (key << 8n) | BigInt(b);
  }
  // Ensure non-zero
  return key === 0n ? 1n : key;
}

/**
 * Compute identity commitment: Poseidon(privateKey)
 */
export function computeIdentityCommitment(privateKey: bigint): bigint {
  return poseidon1([privateKey]);
}

/**
 * Create a full identity from a private key.
 */
export function createIdentity(privateKey?: bigint): Identity {
  const key = privateKey ?? generatePrivateKey();
  return {
    privateKey: key,
    commitment: computeIdentityCommitment(key),
  };
}

/**
 * Compute credential hash: Poseidon(identityCommitment, slot[0], ..., slot[7])
 */
export function computeCredentialHash(
  identityCommitment: bigint,
  slots: bigint[]
): bigint {
  if (slots.length !== NUM_SLOTS) {
    throw new Error(`Expected ${NUM_SLOTS} slots, got ${slots.length}`);
  }
  return poseidon9([identityCommitment, ...slots]);
}

/**
 * Compute nullifier hash: Poseidon(privateKey, scope)
 * Unique per user per scope, prevents double-use.
 */
export function computeNullifier(privateKey: bigint, scope: bigint): bigint {
  return poseidon2([privateKey, scope]);
}
