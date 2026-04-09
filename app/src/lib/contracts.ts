// Deployed contract addresses — update after testnet deployment
export const CONTRACTS = {
  registry: "0xa1708C934175Bf7EaC25220D560BE0C681725957" as `0x${string}`,
  verifier: "0xd49cA44645E21076dcd83F285D23c99AbeB6D299" as `0x${string}`,
  revocation: "0x735680A32A0e5d9d23D7e8e8302F434e7F30428E" as `0x${string}`,
  kycSBT: "0x335C915Fa62eeBF9804a4398bb85Cd370B333850" as `0x${string}`,
  kycAdapter: "0x3AfBFC76f49A4D466D03775B371a4F6142c6A194" as `0x${string}`,
  zktlsAdapter: "0x310581957E11589F641199C3F7571A8eddEF38c8" as `0x${string}`,
  gatedVault: "0x6C1F9466db7Bc2364b0baC051E73421d5b75354B" as `0x${string}`,
  governance: "0x2D036e311A6f11f8ABd191276Fd381Df55fbE224" as `0x${string}`,
  mockERC20: "0x6670bB42279832548E976Fc9f2ddEbA6A03539F8" as `0x${string}`,
} as const;

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

// ABIs — minimal fragments for frontend interactions

export const REGISTRY_ABI = [
  {
    name: "isIdentityRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isCredentialRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "credentialHash", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isValidRoot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "root", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "updateRoot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newRoot", type: "uint256" }],
    outputs: [],
  },
] as const;

export const VERIFIER_ABI = [
  {
    name: "verifyAndRecord",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "uint256[8]" },
      { name: "publicSignals", type: "uint256[]" },
      { name: "scope", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "isNullifierUsed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifierHash", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

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
  {
    name: "setKycInfo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "ensName", type: "string" },
      { name: "level", type: "uint8" },
      { name: "status", type: "uint8" },
    ],
    outputs: [],
  },
] as const;

export const KYC_ADAPTER_ABI = [
  {
    name: "ingestCredential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "identityCommitment", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
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

export const GATED_VAULT_ABI = [
  {
    name: "depositWithProof",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "proof", type: "uint256[8]" },
      { name: "publicSignals", type: "uint256[]" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "SCOPE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const REVOCATION_ABI = [
  {
    name: "revoke",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "credentialHash", type: "uint256" }],
    outputs: [],
  },
  {
    name: "restore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "credentialHash", type: "uint256" }],
    outputs: [],
  },
  {
    name: "isRevoked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "credentialHash", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "revokeRoot",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "root", type: "uint256" }],
    outputs: [],
  },
  {
    name: "isRootRevoked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "root", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "revokeNullifier",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "nullifier", type: "uint256" }],
    outputs: [],
  },
  {
    name: "isNullifierRevoked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const GOVERNANCE_ABI = [
  {
    name: "proposalCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "proposals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "description", type: "string" },
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    name: "createProposal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "description", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "vote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "choice", type: "uint8" },
      { name: "proof", type: "uint256[8]" },
      { name: "publicSignals", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "getProposalScope",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const MOCK_ERC20_ABI = [
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
