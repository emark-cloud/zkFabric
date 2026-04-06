import { CredentialType, NUM_SLOTS } from "../types";

/**
 * ABI fragment for reading KYC SBT data.
 */
export const KYC_SBT_ABI = [
  {
    name: "getKycInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "ensName", type: "string" },
      { name: "level", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "createTime", type: "uint256" },
    ],
  },
] as const;

/**
 * ABI fragment for the KYCSBTAdapter contract.
 */
export const KYC_ADAPTER_ABI = [
  {
    name: "ingestCredential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "identityCommitment", type: "uint256" },
    ],
    outputs: [{ name: "credentialHash", type: "uint256" }],
  },
  {
    name: "registerComputedCredential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityCommitment", type: "uint256" },
      { name: "_credentialHash", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * KYC status enum matching the SBT contract.
 */
export enum KycStatus {
  NONE = 0,
  APPROVED = 1,
  REVOKED = 2,
}

/**
 * KYC level enum matching the SBT contract.
 */
export enum KycLevel {
  NONE = 0,
  BASIC = 1,
  ADVANCED = 2,
  PREMIUM = 3,
  ULTIMATE = 4,
}

export interface KycInfo {
  ensName: string;
  level: KycLevel;
  status: KycStatus;
  createTime: bigint;
}

/**
 * Pack KYC SBT data into the 8-slot credential schema.
 *
 * Slot mapping:
 *   [0] = 1 (CredentialType.KYC_SBT)
 *   [1] = kycLevel (1-4)
 *   [2] = isActive (1 if approved, 0 otherwise)
 *   [3] = createTime (issuance timestamp)
 *   [4] = jurisdictionCode (caller-provided)
 *   [5] = issuerIdentifier (caller-provided, e.g. hash of adapter address)
 *   [6] = 0 (reserved)
 *   [7] = 0 (reserved)
 */
export function packKycSlots(
  kycInfo: KycInfo,
  jurisdictionCode: bigint = 0n,
  issuerIdentifier: bigint = 0n
): bigint[] {
  const slots: bigint[] = new Array(NUM_SLOTS).fill(0n);
  slots[0] = BigInt(CredentialType.KYC_SBT);
  slots[1] = BigInt(kycInfo.level);
  slots[2] = kycInfo.status === KycStatus.APPROVED ? 1n : 0n;
  slots[3] = kycInfo.createTime;
  slots[4] = jurisdictionCode;
  slots[5] = issuerIdentifier;
  return slots;
}
