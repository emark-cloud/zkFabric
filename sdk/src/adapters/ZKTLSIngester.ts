import { CredentialType, NUM_SLOTS } from "../types";

/**
 * ABI fragment for the ZKTLSAdapter contract.
 */
export const ZKTLS_ADAPTER_ABI = [
  {
    name: "submitAttestation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "identityCommitment", type: "uint256" },
      { name: "attestationData", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "registerComputedCredential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityCommitment", type: "uint256" },
      { name: "credentialHash", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * Attestation data for ZKTLS credentials.
 */
export interface ZKTLSAttestation {
  provider: string; // e.g., "reclaim-credit-score"
  primaryAttribute: bigint; // e.g., credit score band
  timestamp: bigint;
  jurisdictionCode: bigint;
  auxiliaryData1: bigint;
  auxiliaryData2: bigint;
}

/**
 * Pack ZKTLS attestation data into the 8-slot credential schema.
 *
 * Slot mapping:
 *   [0] = 2 (CredentialType.ZKTLS)
 *   [1] = primaryAttribute (provider-specific, e.g., credit score band)
 *   [2] = 1 (isActive — always active at creation)
 *   [3] = timestamp
 *   [4] = jurisdictionCode
 *   [5] = issuerIdentifier (caller-provided, e.g. hash of attestor address)
 *   [6] = auxiliaryData1
 *   [7] = auxiliaryData2
 */
export function packZktlsSlots(
  attestation: ZKTLSAttestation,
  issuerIdentifier: bigint = 0n
): bigint[] {
  const slots: bigint[] = new Array(NUM_SLOTS).fill(0n);
  slots[0] = BigInt(CredentialType.ZKTLS);
  slots[1] = attestation.primaryAttribute;
  slots[2] = 1n; // active
  slots[3] = attestation.timestamp;
  slots[4] = attestation.jurisdictionCode;
  slots[5] = issuerIdentifier;
  slots[6] = attestation.auxiliaryData1;
  slots[7] = attestation.auxiliaryData2;
  return slots;
}
