# zkFabric — Universal Zero-Knowledge Identity for HashKey Chain

> Verify once. Prove anything. Reveal nothing.

**zkFabric** is a selective-disclosure identity router that turns HashKey Chain's native KYC/SBT system into a universal privacy layer. Users get verified once, then generate tailored zero-knowledge proofs for any dApp — DeFi, PayFi, RWA, governance — without ever exposing the underlying identity data.

[![HashKey Chain](https://img.shields.io/badge/HashKey_Chain-Testnet_133-00b4d8?style=flat-square)](https://testnet.hsk.xyz)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square&logo=solidity)](https://soliditylang.org)
[![Circom](https://img.shields.io/badge/Circom-2.1.9-purple?style=flat-square)](https://docs.circom.io)
[![Groth16](https://img.shields.io/badge/Groth16-snarkjs-blue?style=flat-square)](https://github.com/iden3/snarkjs)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**Contracts:** Deployed on HashKey Chain Testnet (Chain ID: 133) — all 10 core contracts verified on Blockscout
**Built for:** [HashKey Chain On-Chain Horizon Hackathon 2026](https://dorahacks.io/hackathon/2045) — ZKID Track ($10K Prize Pool)
**Integration guide:** [`INTEGRATION.md`](./INTEGRATION.md) — ~60 lines of Solidity + ~40 lines of TypeScript to gate any dApp on zkFabric
**Status:** 65/65 tests passing · BIP39-recoverable identities · on-chain revocation enforcement · event-sourced tree replay · Reclaim-backed zkTLS attestor

---

## The Problem

Web3 identity is broken in three ways:

**1. Binary KYC is a privacy failure.** Current solutions (Binance BABT, Coinbase Verify, and even HashKey's own KYC SBT) give dApps a binary signal: "this wallet is KYC'd." But protocols don't need to know *who* you are — they need to know *what* you qualify for. A lending protocol needs to know you're creditworthy, not your passport number. A governance system needs to know you're a unique human, not your home address. Binary KYC leaks far more than necessary.

**2. Credentials are siloed and non-composable.** A user verified on HashKey Exchange can't prove that verification to a DeFi vault without re-doing KYC. A user with a strong lending history on Ethereum can't carry that reputation to HashKey Chain. Every dApp builds its own identity silo, and users start from zero each time.

**3. Developers have no standard.** Every ZKID project at this hackathon (and across Web3) ships its own bespoke verification contract, its own credential format, its own frontend flow. There is no `npm install zkid` that "just works." DeFi protocols wanting compliant identity checks must evaluate, integrate, and maintain custom solutions for each identity provider.

---

## The Solution

zkFabric is an **identity router** — a middleware layer between credential sources and consuming dApps. It accepts credentials from multiple sources, stores them as private commitments in a Poseidon-based Merkle tree, and lets users generate selective-disclosure proofs against those commitments.

The key insight: **separate the credential from the proof.** Credentials come from different places (HashKey KYC SBT, off-chain attestations via zkTLS, on-chain activity). But the proof interface for dApps is always the same — one SDK call, one verifier contract, one answer.

```
┌──────────────────────────────────────────────────────────────────┐
│                     CREDENTIAL SOURCES                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  HashKey     │  │  zkTLS       │  │  On-chain activity   │    │
│  │  KYC SBT    │  │  Attestation │  │  proofs              │    │
│  │             │  │              │  │                      │    │
│  │ • KYC tier  │  │ • Bank bal.  │  │ • Lending history    │    │
│  │ • ENS name  │  │ • Employment │  │ • Gov participation  │    │
│  │ • Revoke    │  │ • GitHub age │  │ • Transaction volume │    │
│  │   status    │  │ • Credit     │  │                      │    │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘    │
│         │                │                      │                │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                    zkFabric IDENTITY LAYER                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              zkFabric Identity Tree                       │    │
│  │                                                          │    │
│  │  User Identity = Poseidon(privateKey)                    │    │
│  │  Credentials stored as leaf commitments                  │    │
│  │  Standard binary IMT (depth 20, Poseidon hash)           │    │
│  │  One identity, many credentials, unlinkable proofs       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  Proof Composer  │  │  Nullifier   │  │  Revocation       │   │
│  │                 │  │  Registry    │  │  Registry         │   │
│  │  Select claims  │  │              │  │                   │   │
│  │  Choose scope   │  │  Prevents    │  │  Issuer can       │   │
│  │  Gen ZK proof   │  │  double use  │  │  revoke creds     │   │
│  └────────┬────────┘  └──────────────┘  └───────────────────┘   │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            ▼  zkFabric SDK: fabric.verify(proof, scope)
┌──────────────────────────────────────────────────────────────────┐
│                     CONSUMING dApps                              │
│                                                                  │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  DeFi      │  │  RWA      │  │  PayFi   │  │  Governance │  │
│  │  Lending   │  │  Vaults   │  │  Rails   │  │  Voting     │  │
│  │            │  │           │  │          │  │             │  │
│  │ "Is user   │  │ "Is user  │  │ "Is user │  │ "Is user a  │  │
│  │ KYC tier   │  │ eligible  │  │ from a   │  │ unique      │  │
│  │ 3+?"       │  │ for this  │  │ non-     │  │ human?"     │  │
│  │            │  │ asset?"   │  │ sanction │  │             │  │
│  │ YES ✓      │  │           │  │ country?"│  │ YES ✓       │  │
│  │ Identity:  │  │ YES ✓     │  │          │  │ Identity:   │  │
│  │ UNKNOWN    │  │ Identity: │  │ YES ✓    │  │ UNKNOWN     │  │
│  │            │  │ UNKNOWN   │  │ Identity:│  │             │  │
│  │            │  │           │  │ UNKNOWN  │  │             │  │
│  └────────────┘  └───────────┘  └──────────┘  └─────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### System Overview

zkFabric has four layers: credential ingestion, identity commitment, proof generation, and on-chain verification.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        zkFabric Protocol                            │
├────────────────┬────────────────┬──────────────────┬────────────────┤
│  Credential    │  Identity      │  Proof           │  Verification  │
│  Adapters      │  Registry      │  Engine          │  Layer         │
│                │                │                  │                │
│  KYCSBTAdapter │  Poseidon ID   │  Circom 2.1.9    │  ZKVerifier    │
│  ZKTLSAdapter  │  Standard IMT  │  Groth16 proofs  │  NullifierReg  │
│                │  Depth 20      │  Client-side gen │  RevocationReg │
├────────────────┴────────────────┴──────────────────┴────────────────┤
│                     HashKey Chain (EVM, Chain 133)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Smart Contract Architecture

```
contracts/
├── core/
│   ├── ZKFabricRegistry.sol        # Main registry — manages identity tree
│   │                                # - Registers Poseidon identity commitments
│   │                                # - Stores credential commitments per identity
│   │                                # - Manages off-chain IMT root updates
│   │                                # - Emits events for off-chain indexing
│   │
│   ├── ZKFabricVerifier.sol         # On-chain Groth16 proof verification
│   │                                # - Verifies selective disclosure proofs
│   │                                # - Checks nullifiers (prevents double-proof)
│   │                                # - Validates scope (which dApp is asking)
│   │                                # - Supports batched verification
│   │
│   └── RevocationRegistry.sol       # Credential revocation
│                                    # - Issuer-controlled revocation list
│                                    # - Merkle-based revocation checks
│                                    # - Revoked creds fail proof generation
│
├── adapters/
│   ├── KYCSBTAdapter.sol            # Reads HashKey's native KYC SBT
│   │                                # - Calls KycSBT.getKycInfo(address)
│   │                                # - Extracts tier, status, ENS binding
│   │                                # - Converts to zkFabric credential format
│   │                                # - Emits credential commitment to registry
│   │
│   └── ZKTLSAdapter.sol             # Accepts zkTLS attestations
│                                    # - Verifies attestor ECDSA signatures
│                                    # - Replay protection via attestation IDs
│                                    # - Maps external claims to credential schema
│
├── consumers/
│   ├── GatedVault.sol               # Demo: RWA vault with ZK access control
│   │                                # - ERC-4626 compliant tokenized vault
│   │                                # - Requires KYC proof for deposit
│   │                                # - Requires creditworthiness for premium tier
│   │                                # - One-line integration via ZKFabricVerifier
│   │
│   └── PrivateGovernance.sol        # Demo: Anonymous voting with proof of humanity
│                                    # - ZK proof-based anonymous signals
│                                    # - One person = one vote via nullifiers
│                                    # - No wallet linkability
│
└── interfaces/
    ├── IZKFabric.sol                # Core interface for all consumers
    └── ICredentialAdapter.sol       # Interface for credential source adapters
```

### Circuit Architecture

```
circuits/
├── credential/
│   ├── selective_disclosure.circom  # Main circuit — proves credential attributes
│   │                                # Inputs (private):
│   │                                #   - privateKey (identity secret)
│   │                                #   - credentialData[8] (attribute slots)
│   │                                #   - merkleSiblings[20], merklePathIndices[20]
│   │                                # Inputs (public):
│   │                                #   - merkleRoot (current tree root)
│   │                                #   - nullifierHash (prevents double-use)
│   │                                #   - scope (dApp identifier)
│   │                                #   - predicateTypes[8], predicateValues[8]
│   │                                #   - predicateSets[8][4] (for IN_SET)
│   │                                #
│   │                                # The circuit proves:
│   │                                #   1. Identity is in the Merkle tree
│   │                                #   2. Credential belongs to this identity
│   │                                #   3. Selected attributes satisfy predicates
│   │                                #   4. Nullifier is correctly derived
│   │                                #   All without revealing identity or raw data.
│   │
│   └── (predicates are built into the main circuit via PredicateEvaluator)
│
├── lib/
│   ├── poseidon_hasher.circom       # Poseidon hash wrappers (1/2/9 inputs)
│   ├── merkle_proof.circom          # Binary Merkle proof (depth-parameterized)
│   └── predicates.circom            # 5-type predicate evaluator + checker
│
└── build/
    ├── selective_disclosure.wasm     # Compiled circuit (client-side proving)
    ├── selective_disclosure.zkey     # Proving key (Groth16 trusted setup)
    └── verification_key.json        # Verification key (deployed on-chain)
```

### Data Flow

Here is the complete lifecycle of a credential from issuance to verification:

```
PHASE 1: CREDENTIAL ISSUANCE
─────────────────────────────

User has HashKey KYC SBT (tier 3, active, ENS: alice.hsk)
                │
                ▼
    KYCSBTAdapter.ingestCredential(userAddress)
                │
                │  Reads on-chain: KycSBT.getKycInfo(userAddress)
                │  Returns: (ensName, kycLevel, status)
                │
                ▼
    Adapter packs credential into 8-slot schema:
    ┌──────────────────────────────────────────────┐
    │  slot[0] = credentialType  (1 = KYC_SBT)    │
    │  slot[1] = kycTier         (3)               │
    │  slot[2] = isActive        (1)               │
    │  slot[3] = issuanceTime    (1712345678)      │
    │  slot[4] = jurisdiction    (344 = Hong Kong) │
    │  slot[5] = issuerID        (hash of adapter) │
    │  slot[6] = reserved        (0)               │
    │  slot[7] = reserved        (0)               │
    └──────────────────────────────────────────────┘
                │
                ▼
    credentialCommitment = Poseidon(identityCommitment, slot[0..7])
                │
                ▼
    ZKFabricRegistry.registerCredential(identityCommitment, credentialCommitment)
                │
                │  Stores credential hash, updates off-chain IMT
                │  Emits CredentialRegistered event
                │
                ▼
    User stores private credential data locally (browser/device)


PHASE 2: PROOF GENERATION (client-side)
────────────────────────────────────────

dApp requests: "Prove KYC tier >= 3 AND jurisdiction in {344, 840, 826}"
                │
                ▼
    Proof Composer builds circuit inputs:
    ┌──────────────────────────────────────────────┐
    │  Private inputs:                             │
    │    privateKey (identity secret)              │
    │    credentialData[0..7] (raw slot values)     │
    │    merkleSiblings[20], merklePathIndices[20]  │
    │                                              │
    │  Public inputs:                              │
    │    merkleRoot (current tree root from chain)  │
    │    nullifierHash = Poseidon(privateKey, scope)│
    │    scope = hash("gated-vault-v1")            │
    │    predicateTypes[8], predicateValues[8]      │
    │    predicateSets[8][4]:                       │
    │      slot[1]: GREATER_EQUAL, value: 3        │
    │      slot[4]: IN_SET, set: {344, 840, 826}   │
    └──────────────────────────────────────────────┘
                │
                ▼
    snarkjs.groth16.fullProve(inputs, wasm, zkey)
                │
                │  Runs entirely in-browser via WASM
                │  ~2-4 seconds on modern hardware
                │
                ▼
    Output: { proof, publicSignals }


PHASE 3: ON-CHAIN VERIFICATION
───────────────────────────────

User submits proof to dApp's smart contract
                │
                ▼
    GatedVault.depositWithProof(amount, proof, publicSignals)
                │
                ▼
    Calls ZKFabricVerifier.verifyProof(proof, publicSignals)
                │
                ├─── 1. Groth16 pairing check (proof is valid)
                ├─── 2. merkleRoot matches current tree root
                ├─── 3. nullifierHash not in NullifierRegistry
                ├─── 4. scope matches this contract's scope
                └─── 5. Register nullifier (prevents replay)
                │
                ▼
    Verification passed → deposit accepted
    User's identity, KYC details, jurisdiction: NEVER revealed on-chain
```

---

## Credential Schema

zkFabric uses a fixed 8-slot schema for all credentials, regardless of source. This enables a single circuit to handle any credential type.

| Slot | Field | Description | Example Values |
|------|-------|-------------|----------------|
| 0 | `credentialType` | Source identifier | 1 = KYC_SBT, 2 = ZKTLS, 3 = ON_CHAIN |
| 1 | `primaryAttribute` | Main claim value | KYC tier (1-5), credit score band (1-10) |
| 2 | `statusFlag` | Active/revoked/expired | 1 = active, 0 = revoked |
| 3 | `issuanceTimestamp` | When credential was issued | Unix timestamp |
| 4 | `jurisdictionCode` | ISO 3166-1 numeric | 344 (HK), 840 (US), 826 (UK) |
| 5 | `issuerIdentifier` | Hash of issuing adapter | Poseidon(adapterAddress) |
| 6 | `auxiliaryData1` | Type-specific extension | Lending score, account age |
| 7 | `auxiliaryData2` | Type-specific extension | Transaction volume band |

### Supported Predicates

Each slot can be constrained with one predicate during proof generation:

| Predicate | Operation | Example |
|-----------|-----------|---------|
| `NONE` (0) | No constraint on this slot | Slot is ignored |
| `EQUALS` (1) | slot == value | credentialType == 1 |
| `GREATER_EQUAL` (2) | slot >= value | kycTier >= 3 |
| `LESS_THAN` (3) | slot < value | Used for expiry checks |
| `IN_SET` (4) | slot ∈ {a, b, c, d} (max 4) | jurisdiction ∈ {344, 840} |

---

## Developer SDK

The entire point of zkFabric is developer experience. One `npm install`, three functions, done.

### Installation

```bash
npm install @zkfabric/sdk
```

### Quick Start — Verifying a User (dApp Side)

```typescript
import { ZKFabric } from '@zkfabric/sdk';

const fabric = new ZKFabric({
  chainId: 133,
  rpcUrl: 'https://testnet.hsk.xyz',
  registryAddress: '0xa1708C934175Bf7EaC25220D560BE0C681725957', // ZKFabricRegistry
  verifierAddress: '0xd49cA44645E21076dcd83F285D23c99AbeB6D299', // ZKFabricVerifier
});

// Define what you need to know (not WHO they are)
const requirement = fabric.createRequirement({
  scope: 'my-defi-vault-v1',
  predicates: [
    { slot: 1, op: 'GREATER_EQUAL', value: 3 },   // KYC tier >= 3
    { slot: 2, op: 'EQUALS', value: 1 },            // Status is active
    { slot: 4, op: 'IN_SET', value: [344, 840] },   // HK or US jurisdiction
  ],
});

// Verify a submitted proof (on-chain call)
const isValid = await fabric.verifyProof(proof, publicSignals, requirement);
```

### Quick Start — Generating a Proof (User Side)

```typescript
import { ZKFabricWallet } from '@zkfabric/sdk';

const wallet = new ZKFabricWallet({
  provider: window.ethereum,
  chainId: 133,
});

// Step 1: Ingest credential from HashKey KYC SBT
const credential = await wallet.ingestFromKYCSBT();
// Reads your KYC SBT on-chain, packs into credential schema,
// stores private data in browser localStorage (encrypted)

// Step 2: Generate proof for a specific dApp requirement
const { proof, publicSignals } = await wallet.generateProof({
  credentialId: credential.id,
  scope: 'my-defi-vault-v1',
  predicates: [
    { slot: 1, op: 'GREATER_EQUAL', value: 3 },
    { slot: 2, op: 'EQUALS', value: 1 },
    { slot: 4, op: 'IN_SET', value: [344, 840] },
  ],
});

// Step 3: Submit to dApp contract
await vaultContract.depositWithProof(amount, proof, publicSignals);
```

### Solidity Integration (One Line)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@zkfabric/contracts/interfaces/IZKFabric.sol";

contract MyDeFiVault {
    IZKFabric public immutable zkFabric;
    bytes32 public immutable SCOPE = keccak256("my-defi-vault-v1");

    constructor(address _zkFabric) {
        zkFabric = IZKFabric(_zkFabric);
    }

    function deposit(
        uint256 amount,
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external {
        // This is the ENTIRE identity check. One call.
        require(
            zkFabric.verifyAndRecord(proof, publicSignals, SCOPE),
            "zkFabric: proof invalid"
        );

        // Business logic — user is verified, identity is unknown
        _processDeposit(msg.sender, amount);
    }
}
```

---

## Demo Application

The hackathon demo has three screens that demonstrate the complete flow:

### Screen 1: Credential Issuer

The user connects their wallet and the app reads their HashKey KYC SBT status directly from the chain. If verified, they can mint a private credential commitment to the zkFabric registry. This screen also shows the zkTLS flow: the user can attest an off-chain claim (GitHub account age via Reclaim Protocol) and add it as a second credential.

**What the judge sees:** A clean dashboard showing the user's on-chain KYC status, a "Mint Private Credential" button, and real-time feedback as the Poseidon identity commitment is registered on-chain. The credential data itself is stored locally — nothing sensitive goes on-chain.

### Screen 2: Proof Composer

The user selects which claims they want to prove, and for which dApp scope. The UI shows toggles for each predicate ("KYC tier >= 3", "Active status", "HK or US jurisdiction"). When they click "Generate Proof," the circuit runs in the browser via WASM and produces a Groth16 proof in ~3 seconds.

**What the judge sees:** An interactive proof builder where different combinations of claims can be selected. The generated proof is a small JSON blob. The same identity can produce completely different proofs for different dApps — and those proofs are unlinkable thanks to scope-bound nullifiers.

### Screen 3: Partner dApp Demo

A gated RWA vault (ERC-4626) that accepts zkFabric proofs for deposit access. Users with basic KYC get a standard tier. Users who can prove both KYC *and* off-chain creditworthiness (via the zkTLS credential) unlock a premium tier with better yield.

**What the judge sees:** The practical payoff. Two users with different credential combinations getting different access levels — all without the vault ever learning their identity.

### Screen 4: Private Governance

A second consumer contract (`PrivateGovernance.sol`) showing the infrastructure is reusable. Users create proposals, copy the per-proposal scope, generate a proof on the Prove page, and cast an anonymous YES/NO vote. Nullifiers are bound to `keccak256("zkfabric-governance-v1" || proposalId)` so identities can vote on many proposals but never twice on the same one.

**What the judge sees:** The same credential powering two entirely different dApps (DeFi vault + DAO voting) with unlinkable nullifiers — proving zkFabric is reusable ZK identity infrastructure, not a single-purpose demo.

### Screen 5: Revocation Dashboard

Issuer-only dashboard at `/revoke` listing every credential from the on-chain event log via the indexer. Three revocation modes:
- **Credential hash** — revoke a specific leaf
- **Merkle root** — invalidate every proof built against that root (use after rotating out a compromised leaf)
- **Nullifier** — defense-in-depth ban of an already-seen nullifier

All three are enforced by `ZKFabricVerifier.verifyAndRecord` without any circuit changes. Verified by a dedicated e2e test.

---

## Technology Choices and Rationale

| Component | Choice | Why |
|-----------|--------|-----|
| **ZK Proof System** | Groth16 via Circom + snarkjs | Fastest EVM verification (~200k gas). Battle-tested. Client-side proving via WASM is mature. |
| **Identity Primitive** | Custom Poseidon-based (inspired by Semaphore) | Identity = Poseidon(privateKey), credential = Poseidon(identity, slots[8]). Standard binary IMT (depth 20) via @zk-kit/imt. Simpler than Semaphore V4's EdDSA scheme; better suited for custom credential circuits. |
| **Hash Function** | Poseidon | ZK-friendly hash (8x fewer constraints than SHA-256 in-circuit). Native to Semaphore and circomlib. |
| **On-Chain KYC Source** | HashKey KYC SBT | It's the chain's own identity primitive. The KycSBT contract exposes `getKycInfo()` with tier, status, and ENS binding. Building on this signals ecosystem alignment. |
| **Off-Chain Source** | Reclaim Protocol (zkTLS) | Most mature zkTLS SDK. Supports 300+ data providers. Proof generation is fast (~5s). Falls back gracefully if integration is unstable. |
| **Frontend** | Next.js 16 + viem v2 + RainbowKit | Standard stack. viem for type-safe contract interactions. RainbowKit for wallet connection. |
| **Smart Contracts** | Solidity 0.8.28 + Hardhat | Standard. OpenZeppelin for access control and ERC-4626 vault. |
| **Chain** | HashKey Chain Testnet (ID: 133) | Required by hackathon. EVM-compatible, OP Stack based. Testnet HSK via faucet. |

---

## Project Structure

```
zkfabric/
├── contracts/                      # Solidity smart contracts
│   ├── core/
│   │   ├── ZKFabricRegistry.sol    # Identity tree management
│   │   ├── ZKFabricVerifier.sol    # Groth16 on-chain verification
│   │   └── RevocationRegistry.sol  # Credential revocation
│   ├── adapters/
│   │   ├── KYCSBTAdapter.sol       # HashKey KYC SBT integration
│   │   └── ZKTLSAdapter.sol        # zkTLS attestation (ECDSA signatures)
│   ├── consumers/
│   │   ├── GatedVault.sol          # Demo RWA vault (ERC-4626)
│   │   └── PrivateGovernance.sol   # Demo anonymous voting
│   └── interfaces/
│       ├── IZKFabric.sol
│       └── ICredentialAdapter.sol
│
├── circuits/                       # Circom 2.x ZK circuits
│   ├── credential/
│   │   └── selective_disclosure.circom  # Main circuit (9,993 constraints)
│   ├── lib/
│   │   ├── poseidon_hasher.circom  # Poseidon wrappers (1/2/9 inputs)
│   │   ├── merkle_proof.circom     # Binary Merkle proof template
│   │   └── predicates.circom       # 5-type predicate evaluator
│   └── build/                      # Compiled artifacts (large binaries gitignored)
│       └── verification_key.json
│
├── sdk/                            # TypeScript SDK (@zkfabric/sdk)
│   ├── src/
│   │   ├── index.ts                # Barrel export
│   │   ├── types.ts                # Core types, enums, constants
│   │   ├── identity.ts             # Key generation, commitments, nullifiers
│   │   ├── tree.ts                 # Merkle tree wrapper (@zk-kit/imt)
│   │   ├── prover.ts              # Client-side snarkjs wrapper
│   │   ├── ZKFabricWallet.ts       # User-facing credential + proof client
│   │   ├── ZKFabric.ts             # dApp-facing verification client
│   │   └── adapters/
│   │       ├── KYCSBTIngester.ts   # KYC SBT slot packing
│   │       └── ZKTLSIngester.ts    # zkTLS attestation slot packing
│   ├── package.json
│   └── tsconfig.json
│
├── app/                            # Next.js 16 demo frontend
│   ├── src/app/
│   │   ├── page.tsx                # Landing / connect wallet
│   │   ├── issue/page.tsx          # Screen 1: Credential Issuer
│   │   ├── prove/page.tsx          # Screen 2: Proof Composer
│   │   └── vault/page.tsx          # Screen 3: Gated RWA Vault
│   ├── src/components/
│   │   ├── NavBar.tsx              # Navigation + wallet connect
│   │   ├── CredentialCard.tsx      # Credential display
│   │   ├── ProofBuilder.tsx        # Predicate selector UI
│   │   └── VaultDashboard.tsx      # Vault stats
│   └── src/lib/
│       ├── contracts.ts            # Contract ABIs + deployed addresses
│       └── fabric.ts               # SDK bridge + localStorage persistence
│
├── indexer/                        # Event-sourced Merkle tree indexer
│   └── src/index.ts                # Hono + viem watcher, /leaves /root /health
│
├── attestor/                       # Reclaim Protocol zkTLS backend signer
│   └── src/index.ts                # Hono + @reclaimprotocol/js-sdk + EIP-191 signing
│
├── examples/
│   └── integration-example/        # Minimal third-party dApp consumer
│       └── contracts/ExampleGatedApp.sol
│
├── scripts/
│   ├── deploy.ts                   # Deploy all contracts to testnet
│   ├── deploy-multisig.ts          # Deploy 2-of-N multisig + transfer ownership
│   ├── set-attestor.ts             # Wire ZKTLSAdapter to attestor signing key
│   ├── setup-ceremony.sh           # Groth16 trusted setup (Powers of Tau)
│   └── demo-flow.ts                # End-to-end demo script
│
├── test/
│   ├── circuits/                   # 30 circuit tests
│   │   ├── hello_world.test.ts
│   │   ├── sub_circuits.test.ts
│   │   └── selective_disclosure.test.ts
│   ├── contracts/                  # 25 contract tests
│   │   ├── ZKFabricRegistry.test.ts
│   │   ├── KYCSBTAdapter.test.ts
│   │   └── RevocationRegistry.test.ts
│   └── integration/                # 2 e2e tests
│       └── e2e.test.ts
│
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Circom 2.1.9 (download binary from [GitHub releases](https://github.com/iden3/circom/releases/tag/v2.1.9))
- snarkjs (installed as project dependency)

### 1. Clone and Install

```bash
git clone https://github.com/emark-cloud/zkFabric.git
cd zkFabric
npm install
```

### 2. Compile Circuits

```bash
# Compile the selective disclosure circuit
cd circuits
circom credential/selective_disclosure.circom --r1cs --wasm --sym -o build/

# Groth16 trusted setup (uses Hermez Phase 1 Powers of Tau)
cd ..
bash scripts/setup-ceremony.sh
```

### 3. Compile and Test Contracts

```bash
npx hardhat compile
npx hardhat test
```

### 4. Deploy to HashKey Chain Testnet

```bash
cp .env.example .env
# Add your PRIVATE_KEY to .env

npx hardhat run scripts/deploy.ts --network hashkeyTestnet
```

### 5. Run the Demo Frontend

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
```

### Network Configuration

| Field | Value |
|-------|-------|
| Network Name | HashKey Chain Testnet |
| RPC URL | `https://testnet.hsk.xyz` |
| Chain ID | 133 |
| Symbol | HSK |
| Explorer | `https://testnet-explorer.hsk.xyz` |
| Faucet | Bridge Sepolia ETH via [HashKey Bridge](https://testnet-explorer.hsk.xyz) |
| KYC Testnet | `https://kyc-testnet.hunyuankyc.com` |

---

## Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| `Groth16Verifier` | `0x3a442161cb51555bab8F59351e5E1704e8200506` | [View](https://testnet-explorer.hsk.xyz/address/0x3a442161cb51555bab8F59351e5E1704e8200506) |
| `ZKFabricRegistry` | `0xa1708C934175Bf7EaC25220D560BE0C681725957` | [View](https://testnet-explorer.hsk.xyz/address/0xa1708C934175Bf7EaC25220D560BE0C681725957) |
| `RevocationRegistry` | `0xfC9f91c305dfB69861bB1C7DD9777b4784FeCC8E` | [View](https://testnet-explorer.hsk.xyz/address/0xfC9f91c305dfB69861bB1C7DD9777b4784FeCC8E) |
| `ZKFabricVerifier` | `0xd49cA44645E21076dcd83F285D23c99AbeB6D299` | [View](https://testnet-explorer.hsk.xyz/address/0xd49cA44645E21076dcd83F285D23c99AbeB6D299) |
| `MockKycSBT` | `0x335C915Fa62eeBF9804a4398bb85Cd370B333850` | [View](https://testnet-explorer.hsk.xyz/address/0x335C915Fa62eeBF9804a4398bb85Cd370B333850) |
| `KYCSBTAdapter` | `0x3AfBFC76f49A4D466D03775B371a4F6142c6A194` | [View](https://testnet-explorer.hsk.xyz/address/0x3AfBFC76f49A4D466D03775B371a4F6142c6A194) |
| `ZKTLSAdapter` | `0x310581957E11589F641199C3F7571A8eddEF38c8` | [View](https://testnet-explorer.hsk.xyz/address/0x310581957E11589F641199C3F7571A8eddEF38c8) |
| `MockERC20` | `0x6670bB42279832548E976Fc9f2ddEbA6A03539F8` | [View](https://testnet-explorer.hsk.xyz/address/0x6670bB42279832548E976Fc9f2ddEbA6A03539F8) |
| `GatedVault` | `0x6C1F9466db7Bc2364b0baC051E73421d5b75354B` | [View](https://testnet-explorer.hsk.xyz/address/0x6C1F9466db7Bc2364b0baC051E73421d5b75354B) |
| `PrivateGovernance` | `0x2D036e311A6f11f8ABd191276Fd381Df55fbE224` | [View](https://testnet-explorer.hsk.xyz/address/0x2D036e311A6f11f8ABd191276Fd381Df55fbE224) |

---

## Production Hardening

Beyond the hackathon demo, zkFabric is being pushed toward a real-product bar.
The workstreams below are all merged on `main` (plan:
`.claude/plans/crispy-purring-wozniak.md`):

- **W1 · On-chain revocation enforcement.** `ZKFabricVerifier.verifyAndRecord`
  now checks `RevocationRegistry.isRootRevoked` and `isNullifierRevoked` before
  accepting any proof. Zero circuit changes — enforcement is contract-layer.
- **W2 · Event-indexed tree + recoverable identity.** New
  [`indexer/`](./indexer) package replays `CredentialRegistered` events and
  exposes `/leaves`, `/root`, `/health`. `CredentialTree.fromIndexer()` in the
  SDK hydrates from it. BIP39 12-word mnemonics via `@scure/bip39` make
  identities recoverable — losing the browser no longer bricks credentials.
- **W3 · Real Reclaim zkTLS.** New [`attestor/`](./attestor) Hono service
  verifies Reclaim proofs server-side via `@reclaimprotocol/js-sdk`, packs 8
  credential slots, and signs `keccak256(abi.encodePacked(user, commitment,
  attestationData))` with EIP-191. `ZKTLSAdapter.submitAttestation` recovers
  the exact attestor address — no mock data on the critical path.
- **W4 · Threshold multisig ownership.** New
  [`ZKFabricMultisig.sol`](./contracts/governance/ZKFabricMultisig.sol)
  (~100 lines, 3 tests) replaces single-EOA ownership of Registry, Verifier,
  and RevocationRegistry. `scripts/deploy-multisig.ts` deploys + transfers.
- **W5 · PrivateGovernance UI.** Second consumer dApp live at `/governance` —
  create proposals, per-proposal scopes, anonymous voting. Proves the
  infrastructure is reusable, not a single-purpose vault demo.
- **W6 · NPM SDK + integration guide.** `@zkfabric/sdk` has publish metadata,
  a full README, and [`INTEGRATION.md`](./INTEGRATION.md) — ~60 lines of
  Solidity + ~40 lines of TypeScript for any dApp to gate on zkFabric. A
  reference consumer lives in [`examples/integration-example/`](./examples/integration-example).
- **W7 · Revocation dashboard + atomic KYC ingest.** New `/revoke` page lists
  every credential from the indexer with three revocation modes.
  `KYCSBTAdapter.ingestAndRegister` is a new single-call path that atomically
  validates KYC + registers the hash, putting the adapter on the critical
  path.

All 65 tests still green (`npx hardhat test`).

## Roadmap

- [x] Circom selective disclosure circuit with range and set predicates
- [x] Groth16 trusted setup and client-side proving
- [x] ZKFabricRegistry with standard binary IMT (depth 20)
- [x] ZKFabricVerifier with on-chain Groth16 verification
- [x] KYCSBTAdapter — HashKey KYC SBT integration
- [x] ZKTLSAdapter — Reclaim Protocol zkTLS attestation
- [x] GatedVault demo (ERC-4626 with ZK access tiers)
- [x] PrivateGovernance demo (anonymous voting, full UI)
- [x] TypeScript SDK (`@zkfabric/sdk`) with publish metadata
- [x] Next.js demo app (5 screens: Issue, Prove, Vault, Governance, Revoke)
- [x] Deploy to HashKey Chain Testnet
- [x] Event-sourced indexer replacing localStorage single-point-of-failure
- [x] BIP39-recoverable identities
- [x] Real Reclaim attestor backend signer
- [x] On-chain revocation enforcement (root + nullifier)
- [x] Threshold multisig registry ownership
- [x] `INTEGRATION.md` + reference consumer contract
- [ ] Multi-party trusted setup ceremony (contributor transcript)
- [ ] Security audit
- [ ] Credential expiration and auto-renewal circuits
- [ ] Cross-chain proof relay (verify HashKey proofs on Ethereum)
- [ ] Mobile SDK (React Native)
- [ ] Mainnet deployment

---

## Resources

- **HashKey Chain Docs:** [docs.hashkeychain.net](https://docs.hashkeychain.net)
- **HashKey KYC Integration:** [KYC SBT Documentation](https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC)
- **HashFans Developer Hub:** [hashfans.io](https://hashfans.io)
- **Semaphore V4:** [semaphore.pse.dev](https://semaphore.pse.dev)
- **Reclaim Protocol:** [reclaimprotocol.org](https://reclaimprotocol.org)
- **Circom Documentation:** [docs.circom.io](https://docs.circom.io)
- **snarkjs:** [github.com/iden3/snarkjs](https://github.com/iden3/snarkjs)

---

## License

MIT

---

**Built for the [HashKey Chain On-Chain Horizon Hackathon 2026](https://dorahacks.io/hackathon/2045) — ZKID Track**

> *"Technology Empowers Finance, Innovation Reconstructs Ecosystem"*

HashKey Group operates one of the world's largest regulated crypto exchanges with 600K+ KYC-verified users. zkFabric bridges that institutional trust to the decentralized ecosystem — privately, composably, and natively on HashKey Chain.
