# zkFabric — Project Status & Comprehensive Overview

**Last Updated:** 2026-04-10 (full frontend manual testing, 7 contracts redeployed, per-wallet isolation, indexer polling, credential revocation verified)
**Author:** emark-cloud (solo developer)
**Hackathon:** HashKey Chain On-Chain Horizon Hackathon 2026 — ZKID Track ($10K prize pool)

---

## Table of Contents

1. [What We Are Building](#what-we-are-building)
2. [Architecture & Key Decisions](#architecture--key-decisions)
3. [The Overall Plan (5 Phases)](#the-overall-plan-5-phases)
4. [What Has Been Done](#what-has-been-done)
5. [Where We Are Now](#where-we-are-now)
6. [Known Issues & Bugs Fixed](#known-issues--bugs-fixed)
7. [Next Steps](#next-steps)
8. [Deployed Contracts](#deployed-contracts)
9. [Commit History](#commit-history)
10. [Plan Files](#plan-files)
11. [Memory & Context Notes](#memory--context-notes)
12. [Key File Locations](#key-file-locations)
13. [Hackathon Timeline](#hackathon-timeline)

---

## What We Are Building

**zkFabric** is a zero-knowledge selective-disclosure identity system for HashKey Chain. It lets users:

1. **Issue** — Read their on-chain KYC SBT (or off-chain zkTLS attestations) and mint a private credential commitment
2. **Prove** — Generate a Groth16 ZK proof in-browser that selectively discloses credential attributes without revealing actual values
3. **Access** — Submit the proof on-chain to access gated DeFi vaults, anonymous governance, and other ZK-gated dApps

The key insight: **separate the credential from the proof.** Credentials come from different sources (KYC SBT, zkTLS attestation, on-chain activity), but the proof interface is always the same — one SDK call, one verifier contract, one answer.

### Target Chain
- **HashKey Chain Testnet** (Chain ID: 133)
- EVM-compatible L2 (OP Stack based)
- BN128 precompiles supported — Groth16 on-chain verification works
- RPC: `https://testnet.hsk.xyz`
- Explorer: `https://testnet-explorer.hsk.xyz` (Blockscout)

---

## Architecture & Key Decisions

### Identity System: Custom Poseidon (NOT Semaphore V4)
- Identity = random private key (field element)
- Commitment = `Poseidon(privateKey)`
- Simpler than Semaphore V4's EdDSA + Baby Jubjub approach
- Better suited for custom credential circuits where we need 8-slot hashing

### Credential Commitment: 8-Slot Fixed Schema
- `credentialHash = Poseidon(identityCommitment, slot[0], ..., slot[7])`
- Slot mapping:
  - `[0]` credentialType (1=KYC_SBT, 2=ZKTLS, 3=ON_CHAIN)
  - `[1]` primaryAttribute (e.g., KYC level 1-4)
  - `[2]` statusFlag (1=active, 0=inactive)
  - `[3]` issuanceTimestamp
  - `[4]` jurisdictionCode (e.g., 344=HK)
  - `[5]` issuerIdentifier
  - `[6]` auxiliaryData1
  - `[7]` auxiliaryData2

### Merkle Tree: Standard Binary IMT (NOT LeanIMT)
- Using `@zk-kit/imt` (2.0.0-beta.8) — standard Incremental Merkle Tree
- Fixed depth 20, Poseidon hash, arity 2
- Circuit uses `pathElements[20]` + `pathIndices[20]` format
- Avoided LeanIMT because there's no official Circom template for it

### Nullifier System
- `nullifierHash = Poseidon(privateKey, scope)`
- Unique per user per scope (dApp identifier)
- Prevents double-use within the same scope

### Predicate Evaluator: 5 Types
- `NONE` (0) — skip this slot
- `EQUALS` (1) — slot == value
- `GREATER_EQUAL` (2) — slot >= value
- `LESS_THAN` (3) — slot < value
- `IN_SET` (4) — slot in {v1, v2, v3, v4}

### Circuit: 9,993 Constraints
- Poseidon(1) for identity: ~240
- Poseidon(9) for credential: ~417
- Merkle proof (20 levels): ~4,860
- Poseidon(2) for nullifier: ~240
- 8 predicate evaluators (5 types each): ~4,256
- Fits in ptau 2^14 (16K max), client-side WASM proving in ~3-7 seconds

### Proof System: Groth16
- Phase 1: Hermez Powers of Tau (`powersOfTau28_hez_final_14.ptau`)
- Phase 2: Single-contributor dev ceremony (acceptable for hackathon)
- `Groth16Verifier.sol` auto-generated via snarkjs
- On-chain verification costs ~200K gas

### Reclaim Protocol / zkTLS Strategy
- Reclaim uses signature-based attestation (ECDSA), NOT Groth16/PLONK proofs
- Almost certainly NOT deployed on HashKey Chain testnet
- Current approach: Demo mode with mock zkTLS attestation data (GitHub account age)
- Production approach would be: off-chain Reclaim verification → pack into 8-slot Poseidon commitment → selective disclosure via our Groth16 circuit
- Options considered:
  1. Deploy Reclaim's verifier contract ourselves from their `verifier-solidity-sdk`
  2. Off-chain verify + trusted relayer
  3. Mock adapter for demo (current approach)

### 52 Public Signals
- `[0]` = allPredicatesPass (1 or 0)
- `[1]` = merkleRoot
- `[2]` = nullifierHash
- `[3]` = scope
- `[4-11]` = predicateTypes (8 slots)
- `[12-19]` = predicateValues (8 slots)
- `[20-51]` = predicateSets (8 slots × 4 values each)

---

## The Overall Plan (5 Phases)

### Phase 0: Project Scaffolding ✅
- Monorepo setup (circuits/, contracts/, sdk/, app/, scripts/, test/)
- Toolchain: Circom 2.1.9, snarkjs, Hardhat, Next.js 16, Tailwind v4
- Hello-world circuit compilation test

### Phase 1: ZK Circuits ✅
- Sub-circuits: `poseidon_hasher.circom`, `merkle_proof.circom`, `predicates.circom`
- Main circuit: `selective_disclosure.circom` (9,993 constraints)
- Trusted setup ceremony
- 12/12 circuit tests passing
- Auto-generated `Groth16Verifier.sol`

### Phase 2: Smart Contracts ✅
- Core: `ZKFabricRegistry`, `ZKFabricVerifier`, `RevocationRegistry`
- Adapters: `KYCSBTAdapter`, `ZKTLSAdapter`
- Consumers: `GatedVault` (ERC-4626), `PrivateGovernance`
- Mocks: `MockKycSBT`, `MockERC20`
- Interfaces: `ICredentialAdapter`, `IZKFabric`
- 25 contract tests passing

### Phase 3: TypeScript SDK ✅
- `identity.ts` — createIdentity, computeCredentialHash, computeNullifier
- `tree.ts` — CredentialTree wrapper around @zk-kit/imt
- `prover.ts` — buildCircuitInput, generateProof, verifyProof
- `adapters/KYCSBTIngester.ts` — packKycSlots, KYC_SBT_ABI
- `adapters/ZKTLSIngester.ts` — packZktlsSlots, ZKTLS_ADAPTER_ABI
- `ZKFabricWallet.ts` — user-facing wallet class
- `ZKFabric.ts` — dApp-facing client class
- Zero type errors

### Phase 4: Frontend ✅
- Next.js 16 with Turbopack, Tailwind v4, RainbowKit, wagmi
- Landing page (`/`) — hero, 3-step walkthrough, architecture highlights
- Issue page (`/issue`) — tabbed KYC SBT + zkTLS credential issuance
- Prove page (`/prove`) — credential selection, predicate builder, in-browser proof generation
- Vault page (`/vault`) — ERC-4626 gated vault with proof-based deposit
- "Cryptographic Noir" design system — JetBrains Mono + DM Sans, deep blacks, violet/cyan gradients, CSS animations

### Phase 5: Integration & Deployment ✅
- E2E integration tests (2 passing): full flow + nullifier replay rejection
- All 57 tests green across circuits, contracts, SDK, and integration
- Deployed all 10 contracts to HashKey Chain Testnet
- All contracts verified on Blockscout
- BN128 field overflow bug fixed
- Groth16 pi_b ordering bug fixed
- Full demo flow verified: 747K gas for proof-gated vault deposit

---

## What Has Been Done

### Completed Items (in order)
1. ✅ Full project scaffolding and toolchain setup
2. ✅ Circom circuit design and compilation (9,993 constraints)
3. ✅ Trusted setup ceremony (ptau 2^14)
4. ✅ All smart contracts written and tested (25 tests)
5. ✅ TypeScript SDK with full type safety
6. ✅ Next.js 16 frontend with 4 pages
7. ✅ SSR/localStorage fix via `next/dynamic` ssr:false pattern
8. ✅ E2E integration tests (identity → KYC → credential → proof → vault deposit)
9. ✅ Deployment to HashKey Chain Testnet (all 10 contracts)
10. ✅ BN128 field overflow fix (`scope % BN128_FIELD_PRIME` in GatedVault + PrivateGovernance)
11. ✅ Groth16 pi_b element ordering fix (4 locations: e2e test, sdk/prover.ts, app/lib/fabric.ts, scripts/demo-flow.ts)
12. ✅ README cleanup — removed competition comparison section, fixed documentation accuracy
13. ✅ External feedback review #1 — validated provider wiring (false alarm), MockERC20 (exists), added zkTLS tab to issue page
14. ✅ Fixed vault `depositWithProof` missing `receiver` argument
15. ✅ External feedback review #2 — verified all contracts via `eth_getCode`, added MIT LICENSE, verified all 10 contracts on Blockscout
16. ✅ Fixed `fs` module resolution error in browser bundle (dynamic import with webpackIgnore)
17. ✅ Frontend overhaul — "Cryptographic Noir" design system across all 10 frontend files
18. ✅ Added KYC self-registration buttons on Issue page (BASIC/ADVANCED/PREMIUM/ULTIMATE via MockKycSBT `setKycInfo`)
19. ✅ Fixed mint credential button not working when wallet has no KYC set (added `noKyc` fallback check)
20. ✅ Fixed clipboard copy — added `document.execCommand("copy")` fallback + "Copied!" visual feedback
21. ✅ Added scope presets on Prove page (Gated Vault, Custom) so users don't need to know the raw scope value
22. ✅ Fixed vault scope mismatch — contract uses `keccak256("zkfabric-gated-vault-v1")`, not `"zkfabric.vault"`
23. ✅ Added `setKycInfo` to `KYC_SBT_ABI` in `contracts.ts` for frontend KYC registration
24. ✅ Added PROJECT_STATUS.md comprehensive project overview
25. ✅ Fixed vault scope preset — contract uses `keccak256("zkfabric-gated-vault-v1")`, not `"zkfabric.vault"`
26. ✅ Fixed "invalid merkle root" — frontend never called `updateRoot` on Registry after issuing credentials; added automatic `updateRoot` call in `persistCredential`
27. ✅ Transferred ZKFabricRegistry ownership from deployer to user wallet so frontend can call `updateRoot`
28. ✅ Credential deduplication — re-issuing a credential of the same type (KYC/zkTLS) now replaces the old one instead of creating duplicates

---

## Where We Are Now

**Current State: All 5 phases + W1–W7 production hardening complete. Full frontend manual testing pass on 2026-04-10 with 7 contracts redeployed.**

- All 65 tests passing (12 circuit + 28 contract + 18 SDK + 2 e2e + 5 new)
- 17 contracts deployed on HashKey Chain Testnet (10 original + 7 redeployed for demo-mode permissions and correct wiring)
- Frontend with 7 pages: Landing, Issue, Prove, Vault, Governance, Revoke, plus NavBar
- Per-wallet localStorage isolation (multi-wallet testing supported)
- BIP39 mnemonic-based recoverable identity
- Event-indexed Merkle tree via `indexer/` service with HTTP polling fallback + CORS
- Real Reclaim zkTLS attestation backend (`attestor/` service)
- On-chain credential registration emitting `CredentialRegistered` events (indexer-visible)
- On-chain revocation enforcement **verified live** — credential revoke from Revoke page works
- Demo-mode open permissions: `updateRoot`, `setKycInfo`, `revoke` callable by any wallet
- Custom M-of-N multisig contract for registry governance
- NPM-publishable SDK with INTEGRATION.md + example consumer contract
- MIT LICENSE added

### What's Working
- Wallet connection via RainbowKit on HashKey Chain Testnet (chain 133)
- Identity creation with Poseidon commitment
- KYC self-registration on MockKycSBT from Issue page (BASIC/ADVANCED/PREMIUM/ULTIMATE tiers)
- KYC SBT credential issuance with automatic on-chain Merkle root update
- zkTLS attestation credential issuance (demo mode with GitHub account age)
- Credential persistence in localStorage with same-type deduplication
- Predicate selection with 3 presets + per-slot manual configuration
- Groth16 proof generation in browser (~3-7 seconds)
- Proof JSON export/copy with clipboard fallback
- Scope presets on Prove page (Gated Vault scope pre-filled with correct value)
- Mock token minting and approval on Vault page
- On-chain nullifier replay protection
- Contract source code readable on Blockscout explorer

### Verified on 2026-04-07
- Full frontend flow tested manually on HashKey Chain Testnet: wallet connect → KYC registration → credential issuance (with on-chain root update) → proof generation (Gated Vault scope) → vault deposit with ZK proof — **all passing**

### Verified on 2026-04-08
- W1 revocation enforcement live on testnet via `scripts/smoke-revocation.ts`:
  - Fresh identity + credential → ingestCredential + registerComputedCredential → updateRoot → Groth16 proof generated → `verifyAndRecord` accepted (623k gas) → `revokeRoot` → second proof reverts with `"ZKFabricVerifier: root revoked"`

### Verified on 2026-04-09
- **9-step live testnet E2E** via `scripts/e2e-testnet.ts` — ALL 9 STEPS PASSED:
  1. Create identity (BIP39-style random key → Poseidon commitment)
  2. Set KYC on MockKycSBT (PREMIUM/APPROVED)
  3. Issue credential via KYCSBTAdapter + updateRoot
  4. Generate Groth16 proof (Gated Vault scope)
  5. Mint 1000 mUSDC + approve + depositWithProof (100 mUSDC)
  6. Create governance proposal
  7. Generate proof (governance scope) + cast anonymous YES vote
  8. Revoke Merkle root via RevocationRegistry
  9. Proof against revoked root rejected on-chain
- **Playwright frontend testing** — all 6 routes visually verified:
  - Landing page: hero + 3 feature cards + "Under the Hood" section
  - Issue, Prove, Vault, Governance, Revoke: all render with proper wallet gating
  - Consistent Cryptographic Noir theme, active nav link highlighting
  - Console errors are only expected infra warnings (no indexer running, placeholder WalletConnect ID)
- **4 redeployed contracts verified on Blockscout** (ZKFabricVerifier, GatedVault, PrivateGovernance auto-matched; RevocationRegistry verified)
- **README polished** — removed "Production Hardening" section, integrated all features cohesively into architecture/data flow/tech choices

### Verified on 2026-04-10
- **Full frontend manual testing** — complete flow tested by user on HashKey Chain Testnet:
  - Per-wallet localStorage isolation: switching wallets shows clean slate
  - KYC self-registration on MockKycSBT (open permissions, auto-refetch after tx)
  - KYC credential issuance with on-chain `registerComputedCredential` + `updateRoot`
  - zkTLS credential issuance via attestor service (DEV MODE) + `submitAttestation` + `registerComputedCredential`
  - Indexer picks up `CredentialRegistered` events via HTTP polling (WebSocket free-tier unsupported)
  - Revoke page lists indexed credentials and revokes them on-chain
- **7 contracts redeployed** for demo-mode open permissions and correct adapter→registry wiring:
  - ZKFabricRegistry (`0x93415...`) — open `updateRoot`
  - ZKFabricVerifier (`0x097f4...`) — wired to new registry + revocation
  - RevocationRegistry (`0x43879...`) — open `revoke`/`revokeRoot`/`revokeNullifier`
  - MockKycSBT (`0x566e1...`) — open `setKycInfo`
  - KYCSBTAdapter (`0x4510e...`) — wired to new registry + new MockKycSBT
  - ZKTLSAdapter (`0xFd631...`) — wired to new registry, attestor = deployer key
  - GatedVault (`0xdA157...`) + PrivateGovernance (`0x4B42F...`) — wired to new verifier
- **Indexer improvements**: CORS middleware added, HTTP polling fallback every 10s, correct registry address

---

## Production Hardening (2026-04-07 onward)

Beyond the 5-phase hackathon demo, zkFabric is now being hardened against a
real-product bar. Plan: `/home/emark/.claude/plans/crispy-purring-wozniak.md`.

### W1 — On-chain revocation enforcement ✅
- `RevocationRegistry` gained root + nullifier revoke/restore with events.
- `ZKFabricVerifier.verifyAndRecord` now calls `isRootRevoked` and
  `isNullifierRevoked` before the nullifier write when a registry is wired.
- `deploy.ts` links verifier → revocation registry automatically.
- New tests: root/nullifier revoke paths in `RevocationRegistry.test.ts`;
  e2e test asserts a real Groth16 proof is rejected after `revokeRoot` and
  after `revokeNullifier` (fresh scope to avoid nullifier collision).
- **No circuit re-ceremony** — enforcement works entirely at the contract
  layer by revoking the Merkle root the proof was built against.

### W2 — Event-indexed tree + recoverable identity ✅
- New `indexer/` package (Hono + viem + tsx) watches
  `CredentialRegistered` via WebSocket with HTTP-polling fallback,
  persists leaves to `./data/state.json`, exposes
  `GET /health`, `GET /leaves`, `GET /root`.
- `CredentialTree.fromIndexer(url)` hydrates the tree from the indexer;
  frontend Issue + Prove pages now call `syncTreeFromIndexer()` with
  localStorage as a fallback cache.
- BIP39 12-word mnemonic identity via `@scure/bip39`: PBKDF2 seed reduced
  mod BN128 prime → valid circuit private key. `loadOrCreateMnemonicIdentity`,
  `restoreFromMnemonic`, and a full-screen backup modal on first creation.
- localStorage is no longer the source of truth — losing the browser no
  longer bricks previously-issued credentials.

### W3 — Real Reclaim zkTLS via backend signer ✅
- New `attestor/` package (Hono + viem + `@reclaimprotocol/js-sdk`):
  - `POST /attest` verifies a Reclaim proof server-side (dynamic import,
    `ATTESTOR_DEV_MODE=1` bypass for local demos),
  - packs 8 credential slots,
  - ABI-encodes `attestationData`,
  - signs `keccak256(abi.encodePacked(user, identityCommitment, attestationData))`
    via EIP-191 — matching `ZKTLSAdapter.submitAttestation`'s recovery path.
- Frontend Issue → zkTLS tab now POSTs to `NEXT_PUBLIC_ATTESTOR_URL`
  (default `http://localhost:8788`) and calls `submitAttestation` on-chain
  instead of fabricating slots in-browser.
- `scripts/set-attestor.ts` hardhat helper wires the deployed adapter to
  the new signing address (`ATTESTOR_ADDRESS=0x... npx hardhat run ...`).
- Smoke-tested locally: `/health` + `/attest` return a valid 65-byte
  signature against a throwaway key.

### W4 — Multi-sig registry governance ✅
- Custom `ZKFabricMultisig.sol` (100-line M-of-N multisig) — submit/confirm/execute
  pattern with duplicate-confirm rejection. Chosen over full UUPS to avoid storage
  layout risk under time pressure.
- `scripts/deploy-multisig.ts` deploys multisig and transfers ownership of
  Registry, Verifier, and RevocationRegistry.
- 3 tests in `ZKFabricMultisig.test.ts` (constructor validation, threshold
  enforcement, routing admin calls through multisig).

### W5 — PrivateGovernance UI ✅
- `app/src/app/governance/page.tsx` — lists proposals, create proposal form,
  per-proposal scope display with copy-to-clipboard, YES/NO vote toggle +
  proof JSON paste + cast vote.
- Scope computation mirrors Solidity: `keccak256(encodePacked("zkfabric-governance-v1", id)) % BN128`.
- `GOVERNANCE_ABI` added to `contracts.ts`.

### W6 — NPM SDK metadata + INTEGRATION.md ✅
- `sdk/package.json` — `@zkfabric/sdk`, repository, keywords, prepublishOnly,
  publishConfig access: public.
- `sdk/README.md` — full API surface, architecture diagram, quickstart,
  predicate table, deployed addresses.
- `INTEGRATION.md` at repo root — 7-section dApp integration guide with scope
  derivation in Solidity + TypeScript, consumer contract template, public
  signals layout table.
- `examples/integration-example/` — minimal Hardhat consumer contract
  (`ExampleGatedApp.sol` calling `IZKFabric.verifyAndRecord`).

### W7 — Revocation UI + KYCSBTAdapter wiring ✅
- `app/src/app/revoke/page.tsx` — loads leaves from indexer, checks revocation
  status in parallel, per-leaf revoke, revoke-by-root, ban-nullifier sections.
- `REVOCATION_ABI` added to `contracts.ts`.
- `KYCSBTAdapter.ingestAndRegister` added — single atomic call that validates
  KYC + registers identity + registers credential hash. Poseidon stays
  off-chain (~100k gas savings).
- NavBar updated with Governance + Revoke links.

### Testnet Redeploy (2026-04-08) ✅
- Discovered deployed ZKFabricVerifier + RevocationRegistry predated W1 —
  revocation enforcement was a no-op on-chain.
- Redeployed: ZKFabricVerifier (wired to registry + revocation), GatedVault,
  PrivateGovernance (immutable `zkFabric` reference cascade), RevocationRegistry.
- **Live smoke test passed** (`scripts/smoke-revocation.ts`):
  - Proof A accepted under scope A (623k gas)
  - `revokeRoot(root)` → Proof B reverts with `"ZKFabricVerifier: root revoked"`
- All addresses updated across contracts.ts, README, SDK README, INTEGRATION.md,
  PROJECT_STATUS.md, deploy-multisig.ts.

### Still to do
- W8 (optional): multi-party trusted setup ceremony with public transcript.
- W9: demo video + README polish.
- Deploy multisig on testnet + transfer ownership (optional before submission).
- Verify new contracts on Blockscout.

---

## Known Issues & Bugs Fixed

### Critical Bugs (Fixed)
1. **BN128 Field Overflow** — `uint256(keccak256(...))` exceeds BN128 field prime. Circuit reduces mod p but contracts didn't. Fixed by adding `% BN128_FIELD_PRIME` in GatedVault and PrivateGovernance scope calculations.

2. **Groth16 pi_b Ordering** — Solidity verifier expects G2 points with elements swapped within each pair: `[[b01,b00],[b11,b10]]` instead of snarkjs format `[[b00,b01],[b10,b11]]`. Fixed in 4 locations.

3. **IMT Type Mismatch** — `proof.index` doesn't exist on IMTMerkleProof, it's `proof.leafIndex`. Also `root`/`leaves` are IMTNode not bigint. Fixed with BigInt() casts.

4. **SSR localStorage Errors** — RainbowKit/wagmi use localStorage at module level. Fixed with `next/dynamic` ssr:false pattern in `providers.tsx`.

5. **fs Module in Browser** — `sdk/src/prover.ts` has a `verifyProof` function that uses `require("fs")`. When bundled for the browser via `fabric.ts`, this causes a build error. Fixed by changing to `await import(/* webpackIgnore: true */ "fs")`.

6. **Vault depositWithProof Missing Arg** — The ABI has 4 params (assets, receiver, proof, publicSignals) but the frontend only passed 3. Fixed by adding `address!` as receiver.

7. **Clipboard Copy Silently Failing** — `navigator.clipboard.writeText` was silently failing in some browser contexts (possibly permissions). Added `document.execCommand("copy")` fallback with temporary textarea, plus "Copied!" visual feedback via state.

8. **Mint Credential Button Not Working** — When wallet had no KYC set on MockKycSBT, `kycData` returned level=0/status=0. The `isApproved` check was false and the zero-address check didn't apply (real contract deployed). Fixed by adding `noKyc` check: `!kycInfo || (kycInfo.level === 0 && kycInfo.status === 0)`.

9. **Vault Scope Mismatch** — Prove page defaulted scope to `1`. GatedVault uses `keccak256(abi.encodePacked("zkfabric-gated-vault-v1")) % BN128_FIELD_PRIME`. Initially computed wrong string (`"zkfabric.vault"`) — corrected after reading the actual Solidity source. Added scope presets on Prove page with correct value.

10. **Invalid Merkle Root** — Frontend built a local Merkle tree in localStorage but never called `updateRoot` on the Registry contract. The on-chain verifier's `isValidRoot()` check always failed. Fixed by calling `updateRoot` automatically after each credential issuance, and transferred Registry ownership to the user's wallet so the frontend can make this call.

11. **Duplicate Credentials** — Re-issuing a credential of the same type (KYC or zkTLS) appended to the list instead of replacing. Users saw 2+ credentials of the same type on the Prove page with no way to tell which was latest. Fixed by filtering out old credentials of the same type in `persistCredential`.

### Minor Issues (Fixed)
- npm install corruption from concurrent installs — fixed with clean reinstall
- Turbopack vs webpack conflict — fixed with `turbopack: {}` in next.config.ts and `--webpack` build flag
- Google Fonts ECONNRESET — removed Google font imports, used system fonts (later replaced with next/font/google)
- ES2017 target with BigInt literals — changed tsconfig to ES2020
- Vault ABI tuple type — `bigint[]` not assignable to `readonly [bigint x8]` — fixed with explicit tuple cast
- snarkjs missing types — created `src/types/snarkjs.d.ts`

### Known Limitations
- Reclaim proof verification runs server-side in `attestor/` service (Reclaim not deployed on HashKey Chain); `ATTESTOR_DEV_MODE=1` bypasses verification for local demos
- KYC SBT contract address unknown (HashKey docs don't publish it) — using MockKycSBT
- Only single-contributor trusted setup ceremony (acceptable for hackathon, not production)
- @zk-kit/imt is beta (2.0.0-beta.8) — API stable but version number is pre-release
- 4 redeployed contracts not yet verified on Blockscout (verifier, vault, governance, revocation)
- Multisig not yet deployed on testnet — registry/verifier still owned by single EOA
- WSL2 network environment requires `scripts/force-ipv4.cjs` preload for reliable RPC connectivity

---

## Next Steps

### High Priority (Before Submission — Apr 14)
1. ~~**Complete vault deposit test**~~ — **DONE** (2026-04-07)
2. ~~**W1–W7 production hardening**~~ — **DONE** (2026-04-08)
3. ~~**Live testnet smoke test**~~ — **DONE** (2026-04-08)
4. ~~**9-step live testnet E2E**~~ — **DONE** (2026-04-09)
5. ~~**Verify contracts on Blockscout**~~ — **DONE** (2026-04-09)
6. ~~**Playwright frontend testing**~~ — **DONE** (2026-04-09, all 6 routes verified)
7. ~~**README polish for submission**~~ — **DONE** (2026-04-09)
8. ~~**Full frontend manual testing**~~ — **DONE** (2026-04-10, 7 contracts redeployed, all flows working)
9. **Record demo video** — 4-minute screencast (required by hackathon):
   - Connect → mnemonic backup → Register KYC → Issue credential → Prove (Gated Vault scope) → Vault deposit → Governance vote → Revoke credential → Revoked proof fails
10. **Verify redeployed contracts on Blockscout** — 7 new contracts need source verification
11. **Deploy multisig on testnet** (optional) — transfer ownership via `deploy-multisig.ts`

### Lower Priority (Nice-to-Have)
7. **W8: Multi-party trusted setup ceremony** — recruit 2 contributors, publish transcript
8. **Improve mobile responsiveness** — NavBar links hidden on mobile but no hamburger menu
9. **Multi-credential proof** — Support proving multiple credentials in a single proof

---

## Deployed Contracts

All deployed on **HashKey Chain Testnet (Chain ID: 133)** and **verified on Blockscout**.

| Contract | Address | Explorer |
|---|---|---|
| Groth16Verifier | `0x3a442161cb51555bab8f59351e5e1704e8200506` | [View](https://testnet-explorer.hsk.xyz/address/0x3a442161cb51555bab8f59351e5e1704e8200506#code) |
| ZKFabricRegistry | `0x93415BCDbAda30f06274c32fE7b713bF9AB460C1` | [View](https://testnet-explorer.hsk.xyz/address/0x93415BCDbAda30f06274c32fE7b713bF9AB460C1#code) |
| RevocationRegistry | `0x4387911A3Dbd17C6083f75784c3121E01a207BD8` | [View](https://testnet-explorer.hsk.xyz/address/0x4387911A3Dbd17C6083f75784c3121E01a207BD8#code) |
| ZKFabricVerifier | `0x097f440AECDD999ad6F33229a6cc24Ef27E85267` | [View](https://testnet-explorer.hsk.xyz/address/0x097f440AECDD999ad6F33229a6cc24Ef27E85267#code) |
| MockKycSBT | `0x566e1F1B5bD7109F2C86805e2c092502D1B2f9f4` | [View](https://testnet-explorer.hsk.xyz/address/0x566e1F1B5bD7109F2C86805e2c092502D1B2f9f4#code) |
| KYCSBTAdapter | `0x4510eA78880B7095f1f68F4E8029B776f3c8beA1` | [View](https://testnet-explorer.hsk.xyz/address/0x4510eA78880B7095f1f68F4E8029B776f3c8beA1#code) |
| ZKTLSAdapter | `0xFd631dfa331088CEc9e1ecdC8678A456b721EbD1` | [View](https://testnet-explorer.hsk.xyz/address/0xFd631dfa331088CEc9e1ecdC8678A456b721EbD1#code) |
| MockERC20 | `0x6670bB42279832548E976Fc9f2ddEbA6A03539F8` | [View](https://testnet-explorer.hsk.xyz/address/0x6670bB42279832548E976Fc9f2ddEbA6A03539F8#code) |
| GatedVault | `0xdA1572E9E8466e04A160AF33AD29B569117Be7Be` | [View](https://testnet-explorer.hsk.xyz/address/0xdA1572E9E8466e04A160AF33AD29B569117Be7Be#code) |
| PrivateGovernance | `0x4B42F27BA0ce81Be19B5FCe4bb1B1E6dbDE6f2A9` | [View](https://testnet-explorer.hsk.xyz/address/0x4B42F27BA0ce81Be19B5FCe4bb1B1E6dbDE6f2A9#code) |

**Deployer/Owner:** `0xECf5e30F091D1db7c7b0ef26634a71d46DC9Bb25`

---

## Commit History

```
46323dc Polish README for hackathon submission — integrate all features cohesively
39cffb5 Add full 9-step E2E test against live HashKey Chain Testnet
8a66ba4 Update CLAUDE.md and README.md with W1-W7 status and new addresses
6ad9f06 Update PROJECT_STATUS.md with W1-W7 completion and testnet smoke results
35b8835 Redeploy RevocationRegistry and smoke-test W1 on live testnet
e59a312 Redeploy verifier with W1 revocation enforcement on testnet
bd8bef9 Add redeploy-verifier script to activate W1 revocation on testnet
22687c4 Polish README for submission with W1-W7 hardening summary
994c9e7 Add issuer revocation dashboard and atomic KYC ingest path
974a5ee Add npm publish metadata, SDK README, INTEGRATION.md, and example consumer
3e271d9 Add PrivateGovernance UI as a second ZK consumer
f7a292b Add ZKFabricMultisig to replace single-EOA ownership
a8e08fa Update PROJECT_STATUS with W1-W3 production hardening progress
3bb3738 Add Reclaim attestor service and wire zkTLS issuance
32dad3d Add indexer service and BIP39 recoverable identity
5b32818 Enforce credential revocation in ZKFabricVerifier
f6fe815 Replace duplicate credentials of same type on re-issue
45840a7 Add on-chain Merkle root update after credential issuance
c433a95 Fix vault scope preset to match actual contract value
6ac7333 Fix scope mismatch, clipboard copy, and KYC registration UX
c378677 Overhaul frontend with Cryptographic Noir design system
da962e0 Fix fs module resolution error in browser bundle
21be542 Add MIT license and verify all contracts on Blockscout
1c39987 Add zkTLS credential issuance flow and fix vault deposit args
0fb9da6 Remove competition comparison section from README
9318e45 Fix README and CLAUDE.md to match actual implementation
9ba4c24 zkFabric: Zero-knowledge selective-disclosure identity for HashKey Chain
```

---

## Plan Files

Located in `/home/emark/.claude/plans/`:

| File | Description |
|---|---|
| `federated-fluttering-gadget.md` | Most recent — "Cryptographic Noir" frontend overhaul plan (10 files, design system, animation utilities, font choices) |
| `compiled-popping-cook.md` | Earlier plan |
| `linked-juggling-bear.md` | Earlier plan |
| `parsed-waddling-peach.md` | Earlier plan |
| `purrfect-frolicking-rainbow.md` | Earlier plan |
| `velvety-zooming-sundae.md` | Earlier plan |

---

## Memory & Context Notes

Stored in `/home/emark/.claude/projects/-home-emark-hashkey/memory/`:

### User Profile (`user_profile.md`)
- Solo full-stack Web3 developer
- Comfortable with Solidity/Hardhat and frontend frameworks
- New to zero-knowledge proofs and Circom circuits — this is their entry point into ZK
- Working solo on zkFabric for the HashKey Chain hackathon (ZKID track, $10K prize pool)

### zkFabric Project Decisions (`project_zkfabric.md`)
- Poseidon-based identity (NOT Semaphore V4 EdDSA) for circuit simplicity
- Standard binary IMT (NOT LeanIMT) to avoid circom compatibility issues
- Custom Circom selective_disclosure circuit (~9,993 constraints, Groth16)
- 8-slot fixed credential schema
- Hybrid on-chain/off-chain Merkle tree (events + off-chain tree, admin root updates)
- Circuit is the critical path — everything else depends on it

### Reclaim Protocol Strategy (`project_reclaim_strategy.md`)
- Reclaim uses signature-based attestation (ECDSA), NOT Groth16 proofs
- Almost certainly NOT deployed on HashKey Chain testnet (chain 133)
- Current approach: Mock adapter for demo
- Production approach: Off-chain Reclaim verification → pack into 8-slot Poseidon commitment → selective disclosure via Groth16 circuit
- Alternative: Deploy Reclaim's verifier contract from their `verifier-solidity-sdk` GitHub repo

---

## Key File Locations

### Circuits
```
circuits/
├── credential/
│   └── selective_disclosure.circom    # Main circuit (9,993 constraints)
├── lib/
│   ├── poseidon_hasher.circom         # Poseidon hash wrappers
│   ├── merkle_proof.circom            # Binary Merkle proof verifier
│   └── predicates.circom              # 5-type predicate evaluator
├── build/                             # Compiled WASM + R1CS
└── keys/                              # Proving/verification keys
```

### Smart Contracts
```
contracts/
├── core/
│   ├── Groth16Verifier.sol            # Auto-generated by snarkjs
│   ├── ZKFabricRegistry.sol           # Identity + credential + root registry
│   ├── ZKFabricVerifier.sol           # Wraps Groth16, records nullifiers
│   └── RevocationRegistry.sol         # Credential revocation
├── adapters/
│   ├── KYCSBTAdapter.sol              # KYC SBT → credential adapter
│   └── ZKTLSAdapter.sol               # zkTLS attestation adapter
├── consumers/
│   ├── GatedVault.sol                 # ERC-4626 proof-gated vault
│   └── PrivateGovernance.sol          # Anonymous voting
├── interfaces/
│   ├── ICredentialAdapter.sol
│   └── IZKFabric.sol
└── mocks/
    ├── MockKycSBT.sol                 # Dev KYC SBT mock
    └── MockERC20.sol                  # Test token
```

### SDK
```
sdk/src/
├── identity.ts                        # createIdentity, computeCredentialHash, computeNullifier
├── tree.ts                            # CredentialTree (wraps @zk-kit/imt)
├── prover.ts                          # buildCircuitInput, generateProof, verifyProof
├── types.ts                           # CredentialType, PredicateType, interfaces
├── adapters/
│   ├── KYCSBTIngester.ts              # packKycSlots, KYC_SBT_ABI, KYC_ADAPTER_ABI
│   └── ZKTLSIngester.ts              # packZktlsSlots, ZKTLS_ADAPTER_ABI
├── ZKFabricWallet.ts                  # User-facing wallet class
├── ZKFabric.ts                        # dApp-facing client class
└── index.ts                           # Barrel exports
```

### Frontend
```
app/src/
├── app/
│   ├── layout.tsx                     # Root layout (fonts, providers, noise overlay)
│   ├── globals.css                    # Design system (colors, keyframes, utilities)
│   ├── providers.tsx                  # next/dynamic ssr:false wrapper
│   ├── page.tsx                       # Landing page (hero, steps, CTA)
│   ├── issue/page.tsx                 # Credential issuance (KYC + zkTLS tabs)
│   ├── prove/page.tsx                 # Proof composer + in-browser generation
│   ├── vault/page.tsx                 # Gated vault deposit with proof
│   ├── governance/page.tsx            # Anonymous voting (PrivateGovernance consumer)
│   └── revoke/page.tsx                # Issuer revocation dashboard
├── components/
│   ├── NavBar.tsx                     # Glassmorphism nav with active indicator
│   ├── ClientProviders.tsx            # Wagmi + RainbowKit + React Query
│   ├── CredentialCard.tsx             # Type-colored credential display
│   ├── ProofBuilder.tsx               # Predicate selector with presets
│   └── VaultDashboard.tsx             # On-chain vault stats
└── lib/
    ├── contracts.ts                   # Deployed addresses + ABI fragments
    └── fabric.ts                      # SDK bridge (imports, localStorage persistence)
```

### New Packages (Production Hardening)
```
indexer/                               # Event-indexed Merkle tree service
├── src/index.ts                       # Hono + viem WebSocket watcher
└── data/state.json                    # Persisted leaves

attestor/                              # Reclaim zkTLS verification + EIP-191 signer
├── src/index.ts                       # Hono service (POST /attest, GET /health)
└── package.json                       # @zkfabric/attestor

examples/integration-example/          # Minimal dApp consumer example
└── contracts/ExampleGatedApp.sol      # ~40-line consumer calling IZKFabric.verifyAndRecord
```

### Scripts & Tests
```
scripts/
├── deploy.ts                          # Full deployment script
├── deploy-multisig.ts                 # Deploy multisig + transfer ownership
├── demo-flow.ts                       # End-to-end scripted demo
├── smoke-revocation.ts                # Live testnet W1 revocation smoke test
├── redeploy-verifier.ts               # Redeploy verifier + cascade consumers
├── redeploy-revocation.ts             # Redeploy RevocationRegistry + rewire verifier
├── set-attestor.ts                    # Wire ZKTLSAdapter to attestor signing key
├── check-signer.ts                    # Print signer address + balance
├── force-ipv4.cjs                     # WSL2 IPv6 workaround for Cloudflare RPC
└── setup-ceremony.sh                  # Trusted setup automation

test/
├── circuits/                          # 12 circuit tests
├── contracts/                         # 28 contract tests (+3 multisig)
├── sdk/                               # 18 SDK tests
└── integration/
    └── e2e.test.ts                    # 2 e2e tests (full flow + nullifier replay)
```

### Config
```
hardhat.config.ts                      # Solidity 0.8.28, optimizer, HashKey testnet, Blockscout verify
app/next.config.ts                     # Webpack fallbacks for Node polyfills, asyncWebAssembly
CLAUDE.md                              # Full development guide + chain details + architecture
```

---

## Hackathon Timeline

| Date | Milestone |
|---|---|
| 2026-03-10 | Hackathon start (clean git history from here) |
| 2026-04-06 | All 5 phases complete, frontend overhauled, PROJECT_STATUS.md created |
| 2026-04-07 | Fixed scope mismatch, invalid merkle root, credential dedup, KYC registration UX, clipboard fix |
| 2026-04-08 | W1–W7 production hardening complete; redeployed verifier/vault/governance/revocation; live smoke test passed |
| 2026-04-09 | **TODAY** — PROJECT_STATUS updated, remaining: demo video, Blockscout verification, optional multisig deploy |
| 2026-04-14 | Demo submission opens + project pre-screening |
| 2026-04-15 | Registration deadline |
| 2026-04-16 | Official pitch |
| 2026-04-22 | Demo showcase (AWS Office) |
| 2026-04-23 | Final pitch & awards (Web3 Festival) |

### Submission Requirements
- GitHub repo with deployed HashKey Chain contract address in README ✅
- Short demo video ❌ (still needed)
- Clean git history from hackathon start ✅
- Winners must complete KYC verification

---

*This document serves as the single source of truth for the zkFabric project state. Update it as work progresses.*
