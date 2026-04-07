import { poseidon1, poseidon2, poseidon9 } from "poseidon-lite";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { Identity, NUM_SLOTS } from "./types";

// BN128 scalar field prime — private keys must be < this value
const BN128_FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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
 * Generate a fresh BIP39 mnemonic the user can back up.
 * 128 bits of entropy → 12-word phrase (matches MetaMask / standard wallets).
 */
export function generateMnemonic12(): string {
  return generateMnemonic(wordlist, 128);
}

/**
 * Derive a deterministic zkFabric private key from a BIP39 mnemonic.
 *
 * The mnemonic is converted to a 64-byte seed via PBKDF2 (BIP39 standard),
 * then reduced modulo the BN128 scalar field to produce a valid circuit input.
 * The optional `passphrase` is the BIP39 25th-word style passphrase, NOT a
 * wallet password — it lets the user split entropy across factors.
 *
 * Recovery: same mnemonic + passphrase → identical identity, no other state needed.
 */
export function privateKeyFromMnemonic(
  mnemonic: string,
  passphrase: string = ""
): bigint {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid BIP39 mnemonic");
  }
  const seed = mnemonicToSeedSync(mnemonic, passphrase); // 64 bytes
  // Use the first 32 bytes; reduce mod BN128 prime to land in field.
  let acc = 0n;
  for (let i = 0; i < 32; i++) {
    acc = (acc << 8n) | BigInt(seed[i]);
  }
  const key = acc % BN128_FIELD_PRIME;
  return key === 0n ? 1n : key;
}

/**
 * Create an identity directly from a BIP39 mnemonic (recoverable identity).
 */
export function identityFromMnemonic(
  mnemonic: string,
  passphrase: string = ""
): Identity {
  return createIdentity(privateKeyFromMnemonic(mnemonic, passphrase));
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
