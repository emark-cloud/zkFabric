# Competitor Analysis: zkFabric vs zk-creditscore vs Trust

**Date:** 2026-04-11
**Context:** HashKey Chain On-Chain Horizon Hackathon 2026, ZKID Track ($10K prize pool)
**Methodology:** Source code review of each project's GitHub repository

---

## Executive Summary

| Project | Repo | Core Idea | ZK Depth | HashKey Fit | Production Readiness |
|---------|------|-----------|----------|-------------|---------------------|
| **zkFabric** | [emark-cloud/hashkey](https://github.com/emark-cloud/hashkey) | Privacy layer for identity — ZK proofs over KYC credentials | **Deep** (custom Groth16 circuit, 9,993 constraints) | **Strong** (wraps HashKey KYC SBT) | 65 tests, 10 contracts, SDK, indexer |
| **zk-creditscore** | [muhamedag2022/zk-creditscore](https://github.com/muhamedag2022/zk-creditscore) | Privacy-preserving credit scoring with SBT badges | **Shallow** (circuit exists but disconnected from on-chain verifier) | **Weak** (standalone, no KYC SBT integration) | Minimal tests, 3 contracts, no SDK |
| **Trust** | [SamuelOluwayomi/Trust](https://github.com/SamuelOluwayomi/Trust) | Undercollateralized lending via World ID + credit SBTs | **None** (delegates to World ID, no custom circuits) | **Weak** (uses chain as generic EVM, no native features) | No tests visible, 3 contracts, Telegram bot |

**Bottom line:** zkFabric is the strongest ZKID project technically. zk-creditscore has a ZK circuit but doesn't properly connect it to on-chain verification. Trust has the most polished UX concept but is a lending protocol using World ID, not a custom ZK identity system.

---

## Detailed Comparison

### 1. ZK Circuit & Cryptography

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Proof system** | Groth16 (custom circuit) | Groth16 (custom circuit) | World ID (external) |
| **Circuit language** | Circom 2.1.9 | Circom | None (no custom circuits) |
| **Constraint count** | 9,993 | ~1 (single comparison) | N/A |
| **What's proven** | Identity ownership + credential binding + Merkle membership + nullifier correctness + predicate satisfaction (all simultaneously) | Score >= 50 threshold | "I am a unique human" (World ID handles this) |
| **Predicate types** | 5 (NONE, EQUALS, GREATER_EQUAL, LESS_THAN, IN_SET) | 1 (greater-than only) | 0 |
| **Nullifier system** | Custom: `Poseidon(privateKey, scope)` — unique per user per dApp | None | World ID nullifier (external) |
| **Merkle tree** | Standard binary IMT, depth 20, ~1M credentials | None | None |
| **Client-side proving** | Yes (WASM, ~3 seconds) | Yes (WASM) | No (World ID SDK handles it) |
| **On-chain verification** | Full Groth16 pairing check (~200K gas) | Contract has Groth16Verifier but CreditProofVerifier uses a separate two-step requestProof/verifyProof flow | None on-chain |

**Analysis:** zkFabric's circuit is orders of magnitude more sophisticated. It proves five properties simultaneously in a single proof. zk-creditscore's circuit is minimal (one comparison) and there's a disconnect — the on-chain `CreditProofVerifier` doesn't appear to route through the `Groth16Verifier` for actual proof verification. Trust skips custom ZK entirely, which is a significant weakness for the ZKID track.

---

### 2. Smart Contract Architecture

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Contract count** | 10 | 3-4 | 3 |
| **Deployed on** | HashKey Testnet | HashKey Testnet | HashKey Testnet |
| **Core contracts** | Registry, Verifier, RevocationRegistry, Groth16Verifier | CreditScoreRegistry, CreditSBT, CreditProofVerifier | LoanManager, LoanSBT, Faucet |
| **Adapters** | KYCSBTAdapter, ZKTLSAdapter | None | None |
| **Consumer dApps** | GatedVault (ERC-4626), PrivateGovernance | None (SBT minting is the end state) | LoanManager is the consumer |
| **Upgradeable** | No (documented upgrade path) | No | No |
| **Multi-sig** | Threshold multisig contract | No | No |
| **Revocation** | 3-tier (credential, root, nullifier) | No revocation system | Blacklist only (for defaulters) |
| **Solidity version** | 0.8.28 | 0.8.24 | ^0.8.28 |
| **OpenZeppelin** | Yes | Yes (v5.6.1) | Yes (v5.6.1) |

**Analysis:** zkFabric has the deepest contract architecture with clear separation into core/adapter/consumer layers. The adapter pattern is unique — it means any data source can feed into the same proof system. zk-creditscore has a registry + SBT + verifier pattern but no consumer contracts showing how other dApps would use it. Trust's contracts are focused on lending mechanics, not identity infrastructure.

---

### 3. Identity & Privacy Model

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Identity system** | Custom Poseidon-based (BIP39 recoverable) | Wallet address | World ID (biometric) |
| **Privacy level** | Full (identity, credential data, and wallet all hidden) | Partial (score hidden, but wallet address is public in circuit output) | Partial (World ID hides identity, but wallet visible on-chain) |
| **Unlinkability** | Yes (different nullifier per scope) | No | No |
| **Selective disclosure** | Yes (5 predicate types across 8 credential slots) | No (binary eligible/not eligible) | No |
| **Credential format** | 8-slot Poseidon commitment | Single credit score (0-1000) | SBT count as proxy for creditworthiness |
| **Recovery** | BIP39 mnemonic (12 words) | None (tied to wallet) | Privy embedded wallet (social recovery) |
| **Sybil resistance** | Scope-bound nullifiers (one action per identity per scope) | None | World ID nullifier (one loan per human) |

**Analysis:** zkFabric's privacy model is significantly stronger. The combination of identity hiding, unlinkability across scopes, and selective disclosure is the full privacy stack. zk-creditscore leaks the wallet address as a public signal — meaning proofs can be linked to the user. Trust's World ID approach provides strong Sybil resistance but no credential privacy.

---

### 4. HashKey Chain Integration

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **KYC SBT integration** | Yes — reads `getKycInfo()` via adapter, wraps in privacy | No — standalone system | No — uses World ID instead |
| **Chain-specific value** | High — solves HashKey's "mandatory KYC = no privacy" problem | Low — generic credit scoring, could run on any chain | Low — generic lending, could run on any chain |
| **dApp integration pattern** | One function call: `verifyAndRecord(proof, signals, scope)` | No integration pattern for other dApps | No integration pattern for other dApps |
| **Multiple consumers** | Yes (Vault + Governance demonstrate reusability) | No (SBT badge is the only output) | No (lending protocol is self-contained) |
| **Credential sources** | On-chain (KYC SBT) + off-chain (zkTLS via Reclaim) | On-chain only (wallet history analysis) | External (World ID biometric) |

**Analysis:** zkFabric is the only project that directly addresses a HashKey Chain-specific problem (KYC privacy). The adapter pattern + verifier integration makes it genuine shared infrastructure. The other two projects happen to be deployed on HashKey but don't leverage anything unique about the chain.

---

### 5. Frontend & User Experience

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Framework** | Next.js 16 | Next.js 15 | Next.js 16 |
| **Pages** | 7 (landing, issue, prove, vault, governance, revoke) | 1 (home with wallet analysis + badge minting) | ~5 (landing, dashboard, borrow, repay, profile) |
| **Wallet** | RainbowKit + MetaMask | RainbowKit + MetaMask | Privy (embedded, social login) |
| **Design** | Functional, developer-focused | Clean, single-page | Polished (Vanta.js 3D, glassmorphism, Framer Motion) |
| **Multi-channel** | Web only | Web only | Web + Telegram bot |
| **Live demo URL** | No | Vercel-ready (possibly deployed) | No |
| **Onboarding friction** | Medium (create identity, backup mnemonic) | Low (connect wallet, analyze, mint) | Low (social login via Privy) |

**Analysis:** Trust has the most polished visual design and lowest onboarding friction (Privy embedded wallets eliminate seed phrases for end users). zk-creditscore is the simplest UX. zkFabric has the most pages but is more developer-focused — the multi-step flow (identity → credential → proof → use) is powerful but requires explanation.

---

### 6. Testing & Code Quality

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Test count** | 65 passing | 1 file (Counter.sol tests only) | 0 visible |
| **Test types** | Circuit (12), contract (28), SDK, e2e (live testnet) | Utility contract only | None |
| **CI/CD** | No | GitHub Actions | No |
| **TypeScript** | Full (SDK + frontend) | Partial | Full (strict mode) |
| **Code structure** | Monorepo (contracts, sdk, app, indexer, attestor, circuits) | Monorepo (contracts, frontend, backend, zk) | Monorepo (contracts, frontend, bot) |

**Analysis:** zkFabric has dramatically better test coverage. 65 tests including circuit-level tests, contract tests, and live testnet e2e tests. The other two projects have minimal or no testing — a significant risk for hackathon judging credibility.

---

### 7. Backend & Infrastructure

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Indexer** | Yes (Hono + viem, HTTP polling, JSON persistence) | No | No |
| **Attestor** | Yes (Reclaim Protocol + EIP-191 signing) | No | No |
| **Database** | None (event-sourced from chain) | None | Supabase (PostgreSQL) |
| **External APIs** | Reclaim Protocol (zkTLS) | None | World ID, Privy, Supabase |
| **Bot** | No | No | Telegram bot (Telegraf) |

**Analysis:** zkFabric and Trust take opposite approaches. zkFabric is maximally on-chain (event-sourced indexer, no database) while Trust relies on Supabase for state caching. zkFabric's attestor service bridges off-chain data (zkTLS) into the system — a unique capability neither competitor has.

---

### 8. SDK & Reusability

| Aspect | zkFabric | zk-creditscore | Trust |
|--------|----------|----------------|-------|
| **Published SDK** | NPM metadata ready (`@zkfabric/sdk`) | No | No |
| **Integration guide** | Yes (`INTEGRATION.md`) | No | No |
| **dApp integration** | ~30 lines Solidity (`verifyAndRecord`) | Not designed for it | Not designed for it |
| **Reusable components** | Identity, Tree, Prover, Wallet, Client, Adapters | None | None |
| **Example consumer** | 2 (GatedVault, PrivateGovernance) | 0 | 0 |

**Analysis:** zkFabric is the only project designed as infrastructure that other dApps can integrate. The two working consumer contracts (vault + governance) prove the "one function call" integration story. The other projects are self-contained applications, not platforms.

---

## Scoring Summary

| Category (weight) | zkFabric | zk-creditscore | Trust |
|-------------------|----------|----------------|-------|
| **ZK Depth** (25%) | 10/10 | 3/10 | 1/10 |
| **Smart Contracts** (20%) | 9/10 | 5/10 | 6/10 |
| **HashKey Integration** (15%) | 9/10 | 3/10 | 3/10 |
| **Privacy Model** (15%) | 10/10 | 4/10 | 5/10 |
| **Testing** (10%) | 9/10 | 2/10 | 1/10 |
| **Frontend/UX** (10%) | 7/10 | 6/10 | 9/10 |
| **SDK/Reusability** (5%) | 8/10 | 1/10 | 1/10 |
| **Weighted Total** | **9.05** | **3.55** | **3.70** |

---

## Borrowable Ideas

Ideas from competitors worth considering for zkFabric:

### From zk-creditscore

1. **Live Vercel deployment** — Having a publicly accessible demo URL (not just localhost) adds instant credibility. Even a static landing page with contract links helps.

2. **SBT badge output** — After proof verification, mint a non-transferable "Verified" SBT that dApps can check with a simple `balanceOf`. This gives a gas-free fast path for repeat verifications (check SBT first, fall back to ZK proof if not minted).

3. **On-chain activity as credential source** — Transaction count, protocol interactions, and wallet age could be packed into credential slots via a new adapter (e.g., `ActivityAdapter`). This extends zkFabric beyond KYC into reputation.

4. **CI/CD pipeline** — GitHub Actions for automated test runs on push. Judges may check the Actions tab.

### From Trust

5. **Privy embedded wallets** — For non-crypto-native users, Privy's social login + embedded wallet dramatically reduces onboarding friction. Could be an optional alternative to MetaMask.

6. **Telegram bot for notifications** — A bot that alerts users when their credential is about to expire, when a governance proposal they can vote on is created, or when their proof was used in a transaction.

7. **Tier progression mechanics** — Trust's Bronze → Silver → Gold progression based on SBT count is engaging. zkFabric could add a similar concept: "Verified 3 times across different dApps → Trusted Identity tier."

8. **3D/animated landing page** — Trust's Vanta.js background and Framer Motion animations create a premium first impression. Even subtle animations on zkFabric's landing page would help with the demo video.

9. **Supabase for user preferences** — Not for credential data (that stays client-side), but for optional features like notification preferences, proof history dashboard, or multi-device sync settings.

---

## Key Takeaway for Judges

zkFabric is the only project in this comparison that:
- Builds a **custom ZK circuit** with meaningful complexity (9,993 constraints, 5 proof properties)
- Directly addresses a **HashKey Chain-specific problem** (KYC privacy)
- Ships as **reusable infrastructure** (not just a single-purpose dApp)
- Demonstrates **two working consumer contracts** proving the integration story
- Has **comprehensive testing** (65 tests across circuit, contract, SDK, and e2e layers)
- Implements **three-tier revocation** (credential, root, nullifier) — essential for regulated chains

The competitors are competent hackathon entries, but they're building applications on top of existing identity systems (World ID, wallet history), not building the identity infrastructure itself. zkFabric is building the layer that projects like these would integrate with.
