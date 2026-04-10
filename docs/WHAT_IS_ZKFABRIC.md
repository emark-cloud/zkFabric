# What is zkFabric?

## Overview

zkFabric is a **privacy layer for identity** on HashKey Chain. It lets users prove things about themselves (like "I passed KYC" or "my account is older than 2 years") to any dApp **without revealing who they are or their actual data**.

---

## The Problem It Solves

HashKey Chain has a built-in **KYC SBT** (Soulbound Token) — every user who completes identity verification gets one. But today, when a DeFi protocol checks your KYC, it sees *everything*: your wallet address, your KYC level, your ENS name, your verification date. This creates three problems:

1. **Privacy failure** — Every dApp that checks your KYC can link your identity across all your on-chain activity.
2. **Binary access** — It's "KYC'd or not." There's no way to ask nuanced questions like "is this user at least PREMIUM tier?" without seeing all the data.
3. **Credential silos** — KYC data is one source. What about off-chain data like credit scores, social accounts, or employment history? There's no standard way to bring those on-chain privately.

---

## How It Works (The Core Idea)

zkFabric separates the act of **getting verified** from the act of **proving you're verified**. Here's the flow:

### Step 1: Issue a Credential (one-time)
The user's KYC data (or any other verified claim) gets packed into **8 numbered slots** — think of them as a private ID card with 8 fields. A cryptographic hash of this data is registered on-chain. The actual values stay private, stored only in the user's browser.

### Step 2: Generate a ZK Proof (per-dApp)
When a dApp needs verification, the user generates a **zero-knowledge proof** in their browser (~2-4 seconds). This proof says: "I have a registered credential, and my slot values satisfy your requirements" — without revealing which credential, which wallet, or what the actual values are.

### Step 3: Verify On-Chain (by the dApp)
The dApp's smart contract calls one function: `verifyAndRecord(proof, signals, scope)`. If it returns true, the user is verified. The dApp never learns the user's identity.

---

## What Can Be Proven (The Predicate System)

The proof isn't just "I have a credential." Users can prove **specific conditions** on any of the 8 credential slots, using 5 predicate types:

| Predicate | Example | What the dApp Learns |
|-----------|---------|---------------------|
| **EQUALS** | slot[1] == 3 | "User is exactly PREMIUM tier" |
| **GREATER_EQUAL** | slot[1] >= 2 | "User is at least ADVANCED tier" |
| **LESS_THAN** | slot[3] < 1700000000 | "Account created before 2023" |
| **IN_SET** | slot[4] in {344, 840, 826} | "User is in Hong Kong, US, or UK" |
| **NONE** | (skip) | Nothing about this slot |

The dApp sees only the predicate type and threshold — never the actual value.

---

## The Credential Schema (8 Slots)

Every credential uses the same 8-slot format, but different **adapters** pack them differently:

**KYC SBT Credential:**
| Slot | Meaning |
|------|---------|
| 0 | Credential type (1 = KYC) |
| 1 | KYC level (1-4: Basic to Ultimate) |
| 2 | Is active (1 = approved) |
| 3 | Verification timestamp |
| 4 | Jurisdiction code |
| 5 | Issuer ID |
| 6-7 | Reserved |

**zkTLS Credential** (off-chain data like GitHub account age):
| Slot | Meaning |
|------|---------|
| 0 | Credential type (2 = zkTLS) |
| 1 | Primary attribute (e.g., score band) |
| 2 | Is active |
| 3 | Attestation timestamp |
| 4 | Jurisdiction |
| 5 | Issuer ID |
| 6-7 | Auxiliary data |

---

## Privacy Guarantees

1. **Identity hiding** — The dApp never sees the user's wallet address, identity commitment, or credential data
2. **Unlinkability** — Each dApp gets a different **nullifier** (a scope-bound pseudonym), so the same user's proofs across different dApps can't be correlated
3. **Selective disclosure** — Only the predicate result is revealed, not the underlying value ("you're at least PREMIUM" without revealing you're ULTIMATE)
4. **No on-chain history** — Only the nullifier hash is recorded; it can't be traced back to a wallet

---

## System Architecture (All Components)

### ZK Circuit (`selective_disclosure.circom`)
The cryptographic core. A Groth16 circuit (~10,000 constraints) that proves five things simultaneously:
1. You own a valid identity (Poseidon hash check)
2. Your credential is correctly bound to your identity
3. Your credential is in the registered Merkle tree
4. Your nullifier is correctly derived (prevents double-use)
5. All your predicates pass

### Smart Contracts (10 deployed on HashKey Testnet)

**Core layer:**
- **ZKFabricRegistry** — Records credential hashes on-chain, manages a rolling window of 100 valid Merkle roots
- **ZKFabricVerifier** — Verifies Groth16 proofs on-chain, tracks used nullifiers, checks revocation status
- **RevocationRegistry** — Three-tier revocation: revoke individual credentials, entire tree roots, or specific nullifiers
- **Groth16Verifier** — Auto-generated from the circuit; does the elliptic curve pairing math

**Adapter layer** (brings data into the system):
- **KYCSBTAdapter** — Reads HashKey's on-chain KYC SBT and registers it as a zkFabric credential
- **ZKTLSAdapter** — Accepts signed attestations from the backend attestor (for off-chain data like social accounts verified via Reclaim Protocol's zkTLS)

**Consumer layer** (dApps that use proofs):
- **GatedVault** — An ERC-4626 tokenized vault that requires a ZK proof to deposit. Demonstrates DeFi integration.
- **PrivateGovernance** — Anonymous voting where each identity gets one vote per proposal, but votes can't be linked across proposals. Demonstrates governance integration.

**Infrastructure:**
- **ZKFabricMultisig** — M-of-N multisig that owns the registry, preventing single-key control
- **MockKycSBT / MockERC20** — Test contracts for development

### SDK (TypeScript)
Client-side library that any dApp can use:
- **Identity** — BIP39 mnemonic-based identity (12-word recovery phrase, like a wallet seed)
- **Tree** — Manages the credential Merkle tree (local + indexer sync)
- **Prover** — Generates Groth16 proofs in-browser via WebAssembly (~2-4 seconds)
- **Wallet** — User-facing API for managing credentials and generating proofs
- **Client** — dApp-facing API for creating proof requirements and verifying results
- **Adapters** — Pack different data sources (KYC, zkTLS) into the 8-slot schema

### Indexer Service
A lightweight Node.js service that watches `CredentialRegistered` events from the registry contract and maintains an ordered list of credential tree leaves. This means losing your browser storage isn't fatal — the tree can always be rebuilt from on-chain events.

### Attestor Service
A backend that bridges off-chain data into zkFabric. For the hackathon demo, it verifies Reclaim Protocol zkTLS proofs (proving things about web2 accounts like GitHub) and signs the result with an ECDSA key that the on-chain `ZKTLSAdapter` trusts.

### Frontend (6 pages)
- **Landing** — Explains the system, links to demo flow
- **Issue** — Create identity (BIP39 mnemonic), register KYC or zkTLS credential
- **Prove** — Select credential, configure predicates, generate proof, copy JSON
- **Vault** — Paste proof to deposit into the gated ERC-4626 vault
- **Governance** — Create proposals, vote anonymously with proof
- **Revoke** — View indexed credentials, revoke/restore credentials, roots, or nullifiers

---

## Why HashKey Chain Specifically Needs This

1. **HashKey is a regulated chain** — KYC is mandatory. But mandatory KYC without privacy means every protocol sees your identity. zkFabric makes KYC *useful without being invasive*.

2. **The KYC SBT exists but has no privacy API** — HashKey publishes `getKycInfo()` which returns everything. zkFabric wraps it so dApps can ask "is this user KYC'd at level X?" without seeing the answer to "who is this user?"

3. **Compliance + privacy is the killer feature** — Regulated DeFi on HashKey needs to prove users are verified without creating a surveillance chain. zkFabric is the bridge: full compliance (credential is anchored to real KYC), full privacy (proof reveals nothing about identity).

4. **Multiple credential sources** — HashKey's ecosystem isn't just KYC. The adapter pattern means any future data source (credit scores, professional certifications, on-chain reputation) plugs into the same proof system.

5. **dApp integration is trivial** — Any HashKey dApp can gate access with ~30 lines of Solidity (`import IZKFabric; call verifyAndRecord`). This turns zkFabric into shared infrastructure for the entire chain.

6. **Nullifier-based sybil resistance** — Each identity gets one nullifier per scope. This enables one-person-one-vote governance, fair airdrops, and rate-limited access — all without revealing identity.

---

## The Complete Demo Flow

1. Connect wallet, create BIP39-recoverable identity
2. Register KYC on MockKycSBT (select tier)
3. Mint KYC credential (packs KYC data into 8 slots, registers hash on-chain)
4. Navigate to Prove, select credential, set predicates (e.g., "level >= 3"), generate proof (~3s)
5. Copy proof, paste into Vault page, deposit tokens (proof verified on-chain)
6. Create governance proposal, generate new proof (different scope/nullifier), vote anonymously
7. Revoke a credential, attempt proof, verification fails

Every step works end-to-end on HashKey Chain Testnet today, with 65 passing tests and 10 verified contracts.
