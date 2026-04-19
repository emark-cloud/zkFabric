# zkFabric — Final Pitch Prep Research

> A research-style preparation document for the HashKey Chain Horizon Hackathon final pitch (2026-04-23, Web3 Festival, Hong Kong). Three parts: (1) deep dive on HashKey, (2) primer on zero-knowledge proofs and why they matter to HashKey specifically, (3) a written pitch for zkFabric.

---

# PART 1 — HashKey: The Company, the Chain, and the Bet

## 1.1 The parent company in one paragraph

HashKey Group is a Hong Kong-headquartered digital asset financial services group founded by Dr. Xiao Feng — often referred to in Chinese crypto media as "the godfather of Chinese crypto." Xiao Feng was previously president of Bosera Asset Management (one of China's largest mutual fund houses) before joining Wanxiang Holdings in 2011 as Vice Chairman to build out its financial business. In 2015, he co-founded the Wanxiang Blockchain Lab and led Wanxiang's $500K investment into a then-struggling Ethereum Foundation, followed by a $50M commitment to Distributed Capital — China's first blockchain-focused VC, with Vitalik Buterin as a co-founder. HashKey was incubated out of this lineage. In short, HashKey is not a crypto-native startup that bolted on regulatory compliance; it is a regulated financial group that bolted on crypto, with a decade of relationships with the Ethereum core team baked in.

## 1.2 The corporate structure

HashKey today operates as an integrated stack across six jurisdictions (Hong Kong, Singapore, Japan, Bermuda, Ireland, and the United States), holding 13 financial-services licenses. Its main business lines are:

- **HashKey Exchange** — Hong Kong's largest licensed virtual asset trading platform (VATP) by volume. Holds SFC Type 1 (dealing in securities), Type 7 (automated trading services), and a virtual-asset-trading licence under the Securities and Futures Ordinance. It is one of only twelve VATPs on the SFC's official list as of February 2026.
- **HashKey Capital** — venture and asset management arm; one of the most active institutional crypto investors in Asia.
- **HashKey Cloud** — node and infrastructure services, currently providing validator services across roughly 80 mainstream public chains.
- **HashKey Tokenisation** — issuance and lifecycle management for tokenised real-world assets, including the recent first Hong Kong regulated silver-backed RWA token.
- **HashKey Chain** — the group's own Ethereum L2, intended as the settlement venue for everything above.

In late 2024 / early 2025, HashKey listed on the Hong Kong Stock Exchange — making Xiao Feng the first chairman to take a regulated digital-asset group public on HKEX. This is the second IPO of his career (after Bosera) and matters for our pitch in one specific way: a publicly listed parent has audit, disclosure, and reputational stakes in any infrastructure it endorses. It is conservative in what it builds on top of.

## 1.3 HashKey Chain — the technology layer

HashKey Chain is an OP Stack rollup launched on Ethereum mainnet in early 2025. Its testnet (Chain ID 133) has been live since mid-2024 and is what zkFabric currently targets.

| Property | Detail |
|---|---|
| Architecture | OP Stack rollup, EVM-equivalent, op-geth v1.101605.0 |
| Chain IDs | 177 (mainnet) · 133 (testnet) |
| Native token | HSK (18 decimals, listed on HashKey Exchange) |
| Throughput | ~400 TPS measured in lab, low fees |
| Sequencer | Centralised today, with L1 force-inclusion fallback (12-hour delay) — standard OP Stack model |
| Data availability | Modular DA design — Ethereum L1 currently, with the option to switch to alternative DA layers per OP Stack roadmap |
| Bridge | Native canonical bridge (`bridge.hsk.xyz`) |
| Precompiles | Full Ethereum + BN128 (ecAdd / ecMul / ecPairing), meaning Groth16 verification is safe and cheap on-chain |
| Native identity primitive | `IKycSBT` — a soulbound KYC token contract returning `(ensName, level, status, createTime)` |
| Member of Superchain | Listed on superchain.eco; aligned with the broader OP ecosystem |
| Developer programme | **Atlas Grant — $50M denominated in HSK** for ecosystem builders, focused on RWA / PayFi / Stablecoins / BTCFi |

The technology choices reflect the strategy: HashKey did not roll its own consensus or VM. By choosing OP Stack, it inherits Ethereum's liveness and security guarantees, EVM tooling compatibility, and Superchain interoperability — all properties an institutional issuer can underwrite without months of bespoke security review. The chain's distinguishing feature is not its tech stack (which is conventional) but its native identity primitive and compliance-first ecosystem positioning.

## 1.4 The KYC SBT — HashKey's most important on-chain primitive

The `IKycSBT` contract is the piece of HashKey Chain's design that most directly shapes zkFabric. The interface is deliberately simple:

```solidity
function getKycInfo(address account) external view returns (
    string memory ensName,
    uint8 level,        // 0=NONE, 1=BASIC, 2=ADVANCED, 3=PREMIUM, 4=ULTIMATE
    uint8 status,       // 0=NONE, 1=APPROVED, 2=REVOKED
    uint256 createTime
);
function isHuman(address account) external view returns (bool isValid, uint8 level);
```

Users go through KYC via HashKey's verified onboarding portal, and the SBT is minted to their wallet. The SBT carries a 5-tier level (BASIC through ULTIMATE) reflecting the depth of verification, plus an active/revoked status and an ENS-bound name. This is currently HashKey Chain's only on-chain expression of "this wallet has been verified as a real human / institution under regulatory KYC."

It works. But — and this is the foundational observation behind zkFabric — it is a *binary* and *fully transparent* primitive. Anyone who calls `getKycInfo` learns the user's tier, status, and ENS-bound name. That is too much information for almost every consuming application. A lending protocol does not need a user's name; it needs to know they qualify. A governance contract does not need their tier; it needs to know they are unique. By exposing the underlying record, the SBT forces every dApp to act as a custodian of user identity data — the opposite of what privacy law (and good engineering) wants.

## 1.5 The strategic thesis — what HashKey is actually trying to build

HashKey is not trying to be Solana or Base. It is not optimising for retail DeFi throughput, NFT volumes, or memecoin issuance. Public statements from Xiao Feng and the group's roadmap make the bet explicit: **HashKey Chain is the regulated settlement layer for the on-chain financial system that emerges as traditional securities, funds, and payment instruments tokenise.**

The roadmap calls out four pillars in order of strategic importance:

1. **RWA tokenisation** — precious metals, bonds, money-market funds, structured products, eventually equities.
2. **Stablecoins and PayFi** — under Hong Kong's new HKMA-administered Stablecoins Ordinance (in effect from 1 August 2025), licensed FRS (fiat-referenced stablecoin) issuers will need a chain to settle on.
3. **BTCFi** — bringing Bitcoin liquidity into yield-generating structures with regulatory clarity.
4. **AI + on-chain data** — explicitly mentioned in the 2025 roadmap as a longer-horizon track.

The Atlas Grant programme is the concrete expression of this. $50M of HSK earmarked for ecosystem developers, with an explicit RWA / PayFi / Stablecoins / BTCFi focus. The hackathon's four tracks (DeFi / PayFi / AI / **ZKID**) mirror the same pillars — and the existence of a dedicated ZKID track is significant. It tells you HashKey already understands that the binary KYC SBT is not enough.

## 1.6 The Hong Kong regulatory backdrop

To understand why HashKey cares so much about identity infrastructure, you need to understand the regulatory environment it operates in.

Hong Kong has, since 2023, been deliberately positioning itself as the world's most ambitious *regulated* crypto hub. The relevant pieces of the framework:

- **VATP licensing regime (June 2023)** — under amendments to the Anti-Money Laundering and Counter-Terrorist Financing Ordinance (AMLO), any platform offering virtual asset trading to Hong Kong investors must hold an SFC licence. Eleven entities are currently licensed.
- **Stablecoins Ordinance (passed 21 May 2025, in force 1 August 2025)** — administered by the Hong Kong Monetary Authority. Imposes minimum capital (HK$25M paid-up + HK$3M liquid + 12 months operating reserves), 100% reserve backing, asset segregation, and licensing for any entity issuing fiat-referenced stablecoins in or to Hong Kong. The first batch of fully licensed issuers under HKMA is being established now.
- **Tokenisation guidance** — the SFC has issued circulars on tokenised investment products and tokenised securities. Issuers must enforce investor eligibility, holding-period restrictions, and jurisdiction limits at the smart-contract level.

Two consequences matter for our pitch:

1. **Compliance is enforced on-chain, not off-chain.** Regulators expect smart contracts to refuse unauthorised participants — not for a back-office team to reconcile after the fact. That requires identity at the contract layer.
2. **PDPO (Hong Kong's privacy law) and the principle of data minimisation apply.** Putting raw KYC data on a public ledger — even hashed — is legally risky. The Hong Kong Privacy Commissioner has been increasingly active. The only known way to satisfy both regulators *and* PDPO simultaneously is to use cryptographic constructions that prove compliance without exposing the underlying data.

This is a structural, durable demand for ZK identity. It is not a "nice to have privacy feature." It is the precondition for HashKey's RWA strategy to scale beyond the current handful of pilot issuances.

## 1.7 Ecosystem and partners

A short list of names worth remembering for the pitch:

- **B2C2** — major institutional crypto market maker, partnered with HashKey Exchange in 2025 for liquidity provision.
- **Victory Securities** — SFC-licensed Hong Kong broker, partnered for custody and trading services.
- **HabitTrade** — RWA tokenisation platform; integrated its open-source Stove Protocol into HashKey Chain to expand tokenised-asset issuance.
- **Hong Kong-domiciled silver-backed RWA issuer** — issued the first regulated silver-backed RWA token on HashKey Chain in early 2026, the first such issuance in Hong Kong.
- **Ethereum Foundation lineage** — through Wanxiang/Distributed Capital, HashKey has long-standing ties to the Ethereum core team. This matters when judging whether HashKey is "credible" as an L2 operator.

---

# PART 2 — Zero-Knowledge Proofs and Why They Matter to HashKey

## 2.1 What a zero-knowledge proof actually is

A zero-knowledge proof is a cryptographic protocol between two parties — a Prover and a Verifier — that allows the Prover to convince the Verifier that some statement is true, *without revealing any information beyond the truth of the statement itself.*

The concept was introduced in 1985 by Shafi Goldwasser, Silvio Micali, and Charles Rackoff in their paper "The Knowledge Complexity of Interactive Proof Systems." That paper won the first Gödel Prize in 1993 and reshaped theoretical computer science. The original construction was *interactive* — Prover and Verifier exchanged multiple messages, and the proof's validity depended on the Verifier's random challenges.

A zero-knowledge proof must satisfy three properties:

- **Completeness** — if the statement is true and both parties follow the protocol, an honest Verifier always accepts.
- **Soundness** — if the statement is false, no cheating Prover can convince the Verifier except with negligible probability.
- **Zero-knowledge** — the Verifier learns nothing from the interaction beyond the truth of the statement. Formally, anything the Verifier could compute after the interaction, they could already have computed before it.

The classic intuition is the "Ali Baba cave" example: a Prover claims to know a secret password that opens a magic door deep inside a forked cave. Without revealing the password, they prove they know it by entering the cave from one fork and emerging from whichever fork the Verifier (standing outside) calls out. Repeated trials drive cheating probability arbitrarily low.

## 2.2 The historical arc — from interactive proofs to on-chain SNARKs

The journey from theory to production took roughly thirty years. The milestones that matter for a 2026 audience:

- **1985 — Goldwasser, Micali, Rackoff.** Interactive proofs invented. Theoretical only.
- **1986–1988 — Fiat–Shamir transform.** Showed that interactive protocols could be made *non-interactive* by replacing the Verifier's random challenges with a hash function applied to the transcript. This is the trick that makes blockchain ZK possible — you cannot have interactive verification in a smart contract.
- **1988 — Blum, Feldman, Micali (BFM).** Proved that with a shared common reference string, you can have non-interactive zero-knowledge in the standard model.
- **1989 — Schnorr signatures.** A practical sigma-protocol for proving knowledge of a discrete logarithm. The cryptographic ancestor of nearly every modern signature scheme.
- **2010 — Groth.** First short non-interactive ZK arguments — the precursor to SNARKs.
- **2012 — Bitansky, Canetti, Chiesa, Tromer.** Coined "SNARK" (Succinct Non-interactive ARgument of Knowledge). Proved general feasibility.
- **2013 — Pinocchio (PHGR13).** First general-purpose, practical zk-SNARK construction. Opened the door to arbitrary circuits.
- **2014 — Zcash launches**, becoming the first production blockchain to use zk-SNARKs for shielded transactions.
- **2016 — Groth16.** Published by Jens Groth. Smallest known proofs (~200 bytes), cheapest verification (~200K gas on EVM). Still the production gold standard a decade later.
- **2017 — Bulletproofs.** Inner-product argument with no trusted setup. Larger proofs, slower verification, but transparent.
- **2018 — STARKs.** Eli Ben-Sasson and team. Post-quantum, transparent (no trusted setup), but proofs are 50KB–200KB rather than 200 bytes.
- **2019 — PLONK.** Universal trusted setup — one ceremony serves any circuit. Trade-off is slightly larger proofs (~400 bytes) and slightly more expensive verification than Groth16.
- **2020–2024 — production.** Tornado Cash, Semaphore, World ID, Polygon ID, zkSync, StarkNet, Aztec all ship ZK in production for hundreds of thousands of users.

## 2.3 The zoo today — which proof system to pick

Practitioners now choose from a half-dozen mature proof systems based on three trade-off axes: proof size, verifier cost, and trusted-setup burden.

| System | Proof size | Verify cost (EVM) | Trusted setup | Strength |
|---|---|---|---|---|
| **Groth16** | ~200 bytes | ~200K gas | Per-circuit | Smallest, cheapest, oldest in production |
| PLONK | ~400 bytes | ~290K gas | Universal (one-time) | More flexible, audit-friendly |
| Halo2 | ~1 KB | Higher | None (recursive) | Used by Zcash Orchard, Scroll |
| STARKs | 50–200 KB | Much higher | None | Post-quantum, transparent |
| Bulletproofs | log-size | Very high | None | Range proofs, no setup |

For an EVM-settled identity system, Groth16 remains the right call: cheapest verification means cheapest cost to users, smallest proof means cheapest calldata. The trusted-setup burden is mitigated by running a multi-party ceremony before mainnet — every production Groth16 system from Zcash to Tornado has done this and it is well-understood operationally.

## 2.4 Selective disclosure — the property that matters for identity

Most consumer ZK use cases reduce to one pattern: **selective disclosure.** A holder possesses a credential containing many attributes, and proves *some* fact about *some* attributes without revealing the rest.

Concrete examples:

- "I am over 18" — proven from a birthdate without revealing the birthdate.
- "My KYC tier is at least 3" — proven from a tier value of 4 without revealing it is 4.
- "My jurisdiction is in {Hong Kong, US, UK}" — proven without revealing which.
- "My credit score band is between 7 and 10" — proven without revealing the exact score.
- "I am a unique human voting on this proposal" — proven via a *nullifier* derived from the user's secret + the proposal ID, so the same user cannot vote twice but cannot be traced across proposals.

The key property is **unlinkability**: two proofs from the same person, against different scopes, are cryptographically unlinkable. A user's deposit into a DeFi vault and their vote in a DAO cannot be correlated, even by an adversary with full chain history. This is what differentiates ZK identity from "encrypted KYC" or "off-chain whitelists" — the privacy is mathematical, not policy-based.

## 2.5 The two competing approaches — BBS+ vs zk-SNARK credentials

There are essentially two production-grade approaches to selective-disclosure credentials in 2026, and the choice between them shapes everything downstream.

**BBS+ signatures.** A signature scheme (built on bilinear pairings) where a credential issuer signs a vector of attributes once, and the holder can later derive proofs that selectively reveal subsets. W3C, Mattr, and Microsoft Entra are the main institutional adopters. Strengths: no per-circuit trusted setup, well-aligned with W3C Verifiable Credentials data model, mature standardisation. Weaknesses: limited predicate expressiveness (you can reveal or hide an attribute, but proving complex predicates like "my score is in this range and I am in this set of jurisdictions" requires bolt-on constructions); designed for off-chain VC exchange, not for cheap on-chain verification with replay protection.

**zk-SNARK credentials.** A credential is stored as a hash commitment (typically a Poseidon hash of attributes), and the holder generates a SNARK proof that they know a preimage satisfying some predicate, anchored to a Merkle tree the issuer or registry maintains. Semaphore, World ID, Polygon ID, Sismo, zkPass, and zkFabric all sit in this camp. Strengths: arbitrary predicates expressible as circuits, cheap on-chain verification, native nullifier support, full unlinkability. Weaknesses: per-circuit trusted setup, more complex tooling, less mature standards story.

For an on-chain financial system like HashKey, the SNARK approach is the right answer. You need (a) cheap on-chain verification because users pay HSK gas, (b) expressive predicates because RWA compliance involves tier ≥ X *and* jurisdiction ∈ Y *and* status = active, (c) nullifiers because anti-replay matters when a proof unlocks real value. BBS+ is built for the wrong setting — credential exchange between two parties' wallets — and would force every dApp to either accept off-chain proofs (defeating the point of on-chain settlement) or wrap them in a SNARK anyway.

## 2.6 The current production landscape

A short tour of the leading ZK identity systems in production today, to triangulate where zkFabric sits.

- **Semaphore.** Pure anonymous group membership. No credential semantics — you prove "I am in this set" plus a nullifier. Used by quadratic-funding tools and small DAO experiments. Foundational primitive that World ID and zkFabric both build conceptually downstream of.
- **World ID.** Single-purpose: proof of personhood, anchored to biometric Orb verification. Has shipped to ~10M+ users globally. Strong privacy story; weak credential composability — there is one credential ("I am a unique human"), period.
- **Polygon ID.** Heavyweight self-sovereign identity stack with W3C-VC alignment, issuer/holder/verifier roles, and a mobile wallet. Powerful but high integration cost; not chain-native to any one L2.
- **Sismo.** Pivoted away from a general-purpose product, but established the "Data Vault" + "ZK Badges" pattern of aggregating credentials from multiple sources.
- **zkPass.** Specialises in zkTLS — proving claims about Web2 data (CEX balances, education credentials) via TLS session proofs. MPC-based attestation. Strong on Web2 → Web3 bridging, no on-chain identity registry of its own.
- **Reclaim Protocol.** Similar zkTLS focus to zkPass, with a developer SDK and 300+ supported data providers. Used by zkFabric's `ZKTLSAdapter` as the off-chain credential ingestion path.

zkFabric occupies a deliberately narrow but unoccupied position: a chain-native credential router for a specific L2 (HashKey), with multi-source ingestion (KYC SBT, zkTLS, on-chain activity), an 8-slot universal credential schema, an 100-LOC SDK integration story, and full lifecycle infrastructure (recovery, indexing, revocation, multisig). It is not trying to be a general-purpose VC stack like Polygon ID, nor a single-purpose primitive like World ID. It is the missing middle layer for a regulated L2.

## 2.7 Why ZK matters to HashKey, specifically

This is the section that ties the two halves of the prep doc together — the case for why HashKey, more than any other L2, structurally needs a ZK identity layer.

### The compliance/privacy paradox

The defining problem of regulated DeFi is that compliance and privacy pull in opposite directions. Regulators demand KYC, AML, sanctions screening, accreditation, jurisdiction enforcement. Privacy law (Hong Kong's PDPO, EU's GDPR, the new eIDAS 2.0 wallet rules) demands data minimisation — collect and expose the minimum necessary information.

For most of the last decade, the industry resolved this contradiction by punting: either build a closed permissioned chain where all participants are KYC'd and visible to operators (Quorum, Corda), or build an open chain and hope regulators don't notice (most DeFi). Neither is acceptable for HashKey's strategy. A closed chain cannot capture network effects from open developer ecosystems; an unregulated open chain cannot host institutional issuance.

Zero-knowledge proofs are the only known cryptographic resolution to this paradox. They allow a smart contract to learn that a user qualifies, without learning who the user is or anything about them beyond the predicate being proved. This is not a marketing claim — it is a mathematical property of the proof system.

### Five concrete HashKey use cases that require ZK identity

1. **Tokenised securities (RWA).** Reg D / Reg S accreditation rules, jurisdiction restrictions, and holding-period checks must be enforced at the smart-contract level for issuers to underwrite the offering. Today these are enforced by trusted intermediaries (transfer agents). ZK lets them be enforced trustlessly: the contract checks a proof that the buyer is accredited and in an allowed jurisdiction; nothing else is recorded.

2. **Permissioned DeFi pools.** Institutional liquidity providers cannot LP into pools where their counterparties might be sanctioned entities. With ZK, every pool participant can carry a proof of compliance without exposing identity to other participants or to public chain analytics.

3. **Sanctions screening as a public input.** A proof can include "address is not in OFAC list as of block N" as a public output without revealing the address. This is exactly the kind of construction that would let HashKey-issued stablecoins satisfy HKMA reserve and AML conditions while remaining usable in DeFi.

4. **Cross-jurisdiction PayFi flows.** Under the Stablecoins Ordinance, FRS issuers must enforce restrictions on who can receive or send. ZK lets the sender prove they qualify under the receiver's rules without disclosing their full identity or geography.

5. **Anonymous-but-sybil-resistant governance.** DAO votes on protocol parameters where one human equals one vote, but votes are unlinkable. The same primitive supports anonymous proposal submission, anonymous reputation accrual, and anonymous quadratic funding.

### Why HashKey's existing primitives are insufficient on their own

The KYC SBT, while necessary, is the smallest possible identity signal: a binary bit per address with some metadata. It cannot:

- Express predicates other than "I have a tier ≥ X."
- Hide the user's identity from anyone who reads the chain.
- Carry credentials from sources other than HashKey itself.
- Provide replay protection or scope binding.
- Enforce revocation in the verification step (it can revoke the SBT, but proofs already accepted off the SBT are not retroactively invalidated).

A ZK identity layer on top of the SBT solves all five gaps. This is not a competitive proposition to HashKey's primitive — it is the layer that makes the primitive actually useful to the dApp ecosystem.

### The structural conclusion

Every chain that wants to host regulated, institutional, real-world-asset activity will eventually need a ZK identity layer. HashKey is further along the regulatory arc than any other L2 (no other L2 sits inside an SFC-licensed group with an HKMA-licensed stablecoin pipeline), and so its need for this layer is most acute and most immediate. zkFabric is built for that need.

---

# PART 3 — zkFabric: The Pitch

## 3.1 The problem statement

Web3 identity, as it exists today on every L2 including HashKey Chain, suffers three compounding failures.

The first is that **binary KYC is a privacy failure.** Whether the source is HashKey's KYC SBT, Binance's BABT, or Coinbase Verify, the on-chain expression of "this wallet has been verified" is a binary, fully-readable signal. Any dApp that consumes it learns the user's tier, status, and often a wallet-bound name. dApps don't need to know *who* a user is — they need to know what the user *qualifies for.* The current model leaks far more information than the protocol's business logic actually consumes.

The second is that **credentials are siloed and non-composable.** A user verified on HashKey Exchange cannot bring that verification to a DeFi vault on HashKey Chain without re-doing KYC. A user with strong Ethereum lending history cannot port that reputation to HashKey. Every dApp builds its own identity silo; users start from zero with each one. This is a network-effect failure that drags on the entire ecosystem.

The third is that **developers have no standard.** There is no `npm install zkid` for HashKey today. Every ZKID team at this hackathon — including this one — is shipping its own bespoke verifier contract, credential format, frontend flow, and integration story. RWA, PayFi, and DeFi teams who want compliant identity gating must evaluate, integrate, and maintain custom solutions per provider. The result is that almost no one bothers, and binary KYC remains the default.

## 3.2 The solution

zkFabric is a selective-disclosure identity router. Architecturally it is four layers stacked on HashKey Chain:

1. **Credential Adapters** ingest credentials from multiple sources — HashKey's KYC SBT (`KYCSBTAdapter`), off-chain zkTLS attestations via Reclaim Protocol (`ZKTLSAdapter`), and on-chain activity (e.g., lending history, transaction volume).
2. **The Identity Registry** is a Poseidon-based binary Incremental Merkle Tree (depth 20) where each user's credentials live as commitments. The tree is on-chain (root in `ZKFabricRegistry`) and reconstructable from `CredentialRegistered` events.
3. **The Proof Engine** is a single Circom 2.x circuit (9,993 constraints) that proves predicates over an 8-slot credential schema. Proofs are generated client-side via snarkjs WASM in roughly 3 seconds.
4. **The Verification Layer** is `ZKFabricVerifier`, a Groth16 verifier that also enforces nullifier uniqueness, scope binding, root validity, and revocation status — atomically, in one call.

The unlock is the **8-slot universal credential schema**. Every credential, regardless of source, fits the same shape: `[credentialType, primaryAttribute, statusFlag, issuanceTimestamp, jurisdictionCode, issuerIdentifier, auxiliaryData1, auxiliaryData2]`. This is what makes a single circuit, single verifier, single SDK able to handle KYC tiers, zkTLS bank balances, and on-chain reputation without forking the design per credential type. dApps don't need to know or care where a credential came from — only that it satisfies their declared predicates.

The proof composer supports five predicate operators per slot: `EQUALS`, `GREATER_EQUAL`, `LESS_THAN`, `IN_SET` (up to 4 elements), and `NONE`. Combined across 8 slots, this expresses essentially every gating condition a dApp would naturally want — "tier ≥ 3 AND status = active AND jurisdiction ∈ {HK, US, UK}" reduces to three predicate slots, evaluated in the same circuit instance.

Per-scope nullifiers — `nullifier = Poseidon(privateKey, scope)` — provide replay protection within a scope while preserving unlinkability across scopes. The same user voting in two governance proposals, depositing into two vaults, and proving a credential to two different RWA issuers will produce four different nullifiers that cannot be correlated.

## 3.3 What is built and verified

The submission is not a paper or a proof of concept. It is a working system, deployed and verified end-to-end on HashKey Chain Testnet.

- A custom Circom selective-disclosure circuit at 9,993 non-linear constraints — fits inside the Hermez `ptau 2^14` ceremony. Twelve circuit tests passing.
- Ten production smart contracts deployed and Blockscout-verified on HashKey Chain Testnet (Chain 133): `Groth16Verifier`, `ZKFabricRegistry`, `RevocationRegistry`, `ZKFabricVerifier`, `MockKycSBT`, `KYCSBTAdapter`, `ZKTLSAdapter`, `MockERC20`, `GatedVault`, `PrivateGovernance`. Twenty-eight contract tests passing.
- A TypeScript SDK (`@zkfabric/sdk`) with a three-function user-facing API and a one-function dApp-facing API. Full type safety. Eighteen SDK tests.
- A Next.js 16 frontend with six screens (Landing, Issue, Prove, Vault, Governance, Revoke) deployed at [zk-fabric.vercel.app](https://zk-fabric.vercel.app).
- An event-sourced Hono + viem indexer that replays `CredentialRegistered` events to reconstruct the Merkle tree, exposing `/leaves`, `/root`, `/health`. Deployed on Railway. localStorage in the browser is treated as cache, not source of truth.
- A Reclaim Protocol attestor backend that verifies zkTLS proofs server-side and signs credential slots with EIP-191. Deployed on Railway.
- BIP39 mnemonic-based identity recovery — a 12-word seed phrase deterministically derives the Poseidon private key. Lose your laptop, restore your credentials.
- On-chain revocation enforced atomically in the verifier — both Merkle roots and individual nullifiers can be revoked, smoke-tested live on testnet.
- A 2-of-N threshold multisig (`ZKFabricMultisig`) for production registry ownership. Demo mode keeps `updateRoot` and `revoke` open for judging convenience.
- A 9-step end-to-end live testnet flow (`scripts/e2e-testnet.ts`) covering identity creation, KYC issuance, credential registration, proof generation, vault deposit, governance vote, revocation, and rejection of proofs against revoked roots. All nine steps pass.
- Total: 65 of 65 tests green.
- A demo video: [youtu.be/RnBgjBLLtH8](https://youtu.be/RnBgjBLLtH8).

## 3.4 Six technical decisions worth defending

**Groth16 over PLONK or STARKs.** Cheapest on-chain verification (~200K gas vs ~290K for PLONK, MB-scale for STARKs). HashKey users pay HSK; we optimise for them. The per-circuit trusted setup is the only real cost, and it is well-understood — every production Groth16 system handles it via a multi-party ceremony before mainnet.

**Custom Poseidon identity, not Semaphore V4 EdDSA.** Semaphore V4 uses EdDSA over Baby Jubjub plus LeanIMT. Elegant for anonymous group membership, but adds constraint cost and tooling friction for credential circuits. Our identity is `commitment = Poseidon(privateKey)`, a single hash. Simpler primitive, fewer constraints, and a closer match for the credential pattern we actually need.

**Standard binary IMT (depth 20) via `@zk-kit/imt`, not LeanIMT.** LeanIMT has no official Circom template. We don't want a circom impedance mismatch in the verifier that could land us in audit hell. Standard IMT with `pathElements[20] + pathIndices[20]` is well-tested, and the depth-20 capacity (1M+ leaves) is more than enough for our timeline.

**Off-chain Reclaim attestor rather than on-chain Reclaim verification.** Reclaim Protocol is signature-based, not Groth16-based, and is not deployed on HashKey Chain. We verify Reclaim proofs server-side in the attestor, then bridge to the chain via an EIP-191 signature consumed by `ZKTLSAdapter.submitAttestation`. This is the right hybrid — preserves Reclaim's security model without requiring HashKey-Chain-specific deployment from Reclaim.

**Event-sourced indexer with localStorage as cache.** A user identity that lives only in browser storage is a single-point-of-failure waiting to happen. Our indexer replays `CredentialRegistered` events from the registry, so any user with their BIP39 seed can recover their entire credential set on any device. localStorage is purely a performance cache.

**8-slot fixed schema.** A flexible schema (variable-length attributes) would have meant a circuit per credential type and a verification interface per dApp. The fixed 8-slot schema is the design choice that lets one circuit and one verifier cover every credential source. The cost is occasional unused slots; the benefit is universal composability.

## 3.5 Differentiation versus other ZKID submissions

Other ZKID hackathon projects, looking across the submission landscape, tend to (a) build for one credential type, (b) ship a verifier contract plus a demo screen, (c) stop at proof generation, and (d) reuse Semaphore as-is or assemble Polygon ID components. zkFabric does the opposite of each. It builds a router for many credential sources behind one schema; it ships a complete SDK plus indexer plus attestor plus recovery plus multisig; it enforces on-chain revocation, replay protection, and scope binding at the verification step; and it uses a custom Poseidon identity tuned for the credential pattern.

The most relevant existing systems sit in adjacent niches: World ID is single-credential global personhood, Polygon ID is heavyweight cross-chain SSI, Semaphore is bare-bones group membership. None of them is purpose-built for a single regulated L2 with a native KYC primitive. zkFabric is.

## 3.6 Alignment with HashKey's stated strategy

The four pillars HashKey has staked the chain on — RWA, PayFi, BTCFi, AI — each have a clear consumption story for zkFabric. RWA tokenisation needs accreditation and jurisdiction proofs without leaking holder identity. PayFi rails need sanctions and jurisdiction screening as a ZK predicate. Permissioned DeFi pools need compliant gating with privacy preservation. The Atlas Grant ecosystem needs a drop-in SDK that lets any funded dApp gate on KYC SBT in roughly 100 lines of code.

The framing line that closes the pitch: *HashKey already has the regulated identity primitive. zkFabric is the layer that makes every dApp on the chain able to use it — privately, composably, and natively.*

## 3.7 Path forward

For the post-hackathon roadmap, the priorities in order are: (1) multi-party trusted-setup ceremony to replace the current single-contributor dev ceremony, (2) third-party security audit, (3) credential expiration and auto-renewal circuits, (4) cross-chain proof relay for verifying HashKey-issued proofs on Ethereum and other OP Stack chains, (5) a React Native mobile SDK, (6) mainnet deployment on HashKey Chain, and (7) integration partnerships with the RWA issuers identified during the hackathon period.

The business model is open-source SDK with fee-free verification at the protocol level. Sustainable revenue comes from (a) a managed indexer + attestor SaaS for teams that don't want to self-host, and (b) enterprise integration support for tokenised-securities issuers who want bespoke credential adapters or compliance reporting on top of the protocol.

## 3.8 Anticipated questions

**Why not BBS+?** BBS+ is built for off-chain VC exchange. We need on-chain verification with arbitrary predicates and nullifiers; SNARKs are the right tool. A BBS+ adapter is possible if a partner needs it.

**What if HashKey ships its own ZK identity layer?** Then zkFabric is the open-source reference implementation that every dApp on the chain has already integrated. Our SDK is the path of least resistance regardless of who ships the official version.

**How do you handle KYC SBT revocation?** Two layers — `RevocationRegistry` revokes Merkle roots and individual nullifiers on-chain (proofs against revoked roots fail at verification), and `KYCSBTAdapter` re-reads SBT status before issuing fresh credential commitments. Smoke-tested live.

**Trusted-setup risk?** The hackathon submission uses a single-contributor dev ceremony — we are explicit about this. Production path is a multi-party ceremony before mainnet, exactly as Zcash, Tornado, and Semaphore did.

**Why one chain at launch?** HashKey is the launch market because its regulatory posture creates the most acute need. The same circuit, verifier, and SDK port to any EVM chain with BN128 precompiles (Ethereum, Base, Arbitrum, Optimism, every OP Stack chain). Cross-chain is a roadmap item, not an architectural rewrite.

---

## Sources

**HashKey Group, Chain, and ecosystem**
- [Dr. Xiao Feng — HashKey Group leadership profile](https://group.hashkey.com/en/ir-manager/ceo)
- [Xiao Feng — RootData biographical record](https://www.rootdata.com/member/Xiao%20Feng?k=MTI5NDI%3D)
- [HashKey IPO and Wanxiang lineage (PANews)](https://www.panewslab.com/en/articles/24f2107b-35f4-4b9a-afc3-34be4775cf7c)
- [HashKey IPO and Hong Kong listing significance (TMTPost)](https://www.tmtpost.com/7811969.html)
- [HashKey Chain — L2BEAT data and architecture](https://l2beat.com/scaling/projects/hashkey)
- [HashKey Chain — Superchain Eco listing](https://www.superchain.eco/chains/hashkey-chain)
- [HashKey Chain technical architecture (HashKey Chain Medium)](https://medium.com/@HashKeyHSK/exploring-the-technology-behind-hashkey-chain-8ea486666ecd)
- [HashKey Chain mainnet launch — compliance-oriented infrastructure (AICoin)](https://www.aicoin.com/en/article/435060)
- [HashKey Chain 2025 roadmap — RWA, BTCFi, PayFi (AICoin)](https://www.aicoin.com/en/article/438990)
- [HashKey Chain $50M Atlas Grant programme (AICoin)](https://www.aicoin.com/en/article/433930)
- [HashKey Chain — first HK regulated silver-backed RWA token](https://group.hashkey.com/en/newsroom/hashkey-chain-supports-the-onchain-issuance-of-hk-s-first-regulated-silver-backed-rwa-token)
- [HashKey Chain × HabitTrade — RWA tokenisation push (Cointrust)](https://www.cointrust.com/market-news/hashkey-chain-habittrade-boost-rwa-tokenization-push)
- [HashKey Exchange × B2C2 partnership (PRNewswire)](https://www.prnewswire.com/apac/news-releases/hashkey-exchange-hong-kongs-largest-licensed-virtual-asset-exchange-partners-with-global-leading-crypto-market-maker-b2c2-302396572.html)
- [HashKey Exchange × Victory Securities collaboration](https://group.hashkey.com/en/newsroom/hashkey-exchange-has-entered-into-a-collaboration-with-hong-kong-sfc-licensed-corporation-victory-se)
- [Why institutions choose HashKey for RWA (PANews)](https://www.panewslab.com/en/articles/019c8ed7-5c34-77ec-a2b6-953697242e74)
- [HashKey Chain Horizon Hackathon — DoraHacks](https://dorahacks.io/hackathon/2045)

**Hong Kong regulatory framework**
- [SFC official list of licensed VATPs](https://www.sfc.hk/en/Welcome-to-the-Fintech-Contact-Point/Virtual-assets/Virtual-asset-trading-platforms-operators/Lists-of-virtual-asset-trading-platforms)
- [Licensed crypto exchanges in HK 2026 (Fintech HK)](https://fintechnews.hk/licensed-crypto-exchanges-hong-kong/)
- [Hong Kong's framework for regulated VA trading — 2026 legal analysis (HK Lawyer)](https://www.hk-lawyer.org/content/hong-kong%E2%80%99s-comprehensive-framework-regulated-virtual-asset-trading-and-financial-crime)
- [Hong Kong's Stablecoins Ordinance — Davis Polk briefing](https://www.davispolk.com/insights/client-update/hong-kongs-licensing-and-regulatory-framework-stablecoins-now-effect)
- [Hong Kong stablecoin regime — Sidley Austin analysis](https://www.sidley.com/en/insights/newsupdates/2025/08/hong-kong-implements-new-regulatory-framework-for-stablecoins)
- [HKMA Stablecoin Issuers regime](https://www.hkma.gov.hk/eng/key-functions/international-financial-centre/stablecoin-issuers/)

**Zero-knowledge proofs — theory, history, production**
- [Zero-knowledge proof — Wikipedia](https://en.wikipedia.org/wiki/Zero-knowledge_proof)
- [Non-interactive zero-knowledge proof — Wikipedia](https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof)
- [The Knowledge Complexity of Interactive Proof Systems (Goldwasser/Micali/Rackoff, SIAM)](https://epubs.siam.org/doi/10.1137/0218012)
- [A subjective history of ZK proofs (LambdaClass)](https://blog.lambdaclass.com/our-highly-subjective-view-on-the-history-of-zero-knowledge-proofs/)
- [Evolution of SNARKs — interactive proofs to Groth16 (Faulkner)](https://mfaulk.github.io/2024/10/28/evolution-of-snarks.html)
- [Why institutions should use ZK for RWAs (zk.me)](https://blog.zk.me/why-institutions-should-use-zk-for-rwas/)
- [ZK proofs in institutional finance (ChainUp)](https://www.chainup.com/blog/zero-knowledge-proofs-institutional-finance)
- [Selective disclosure VCs (Mattr)](https://medium.com/mattr-global/a-solution-for-privacy-preserving-verifiable-credentials-f1650aa16093)
- [zk-creds: anonymous credentials from zk-SNARKs (eprint 2022/878)](https://eprint.iacr.org/2022/878.pdf)
- [Intro to ZK proofs and Semaphore (World)](https://world.org/blog/world/intro-zero-knowledge-proofs-semaphore-application-world-id)
- [Impact of ZKPs on data minimisation (Policy Review)](https://policyreview.info/articles/analysis/impact-zero-knowledge-proofs)
- [What is zero-knowledge identity? (Chainlink)](https://chain.link/article/what-is-zero-knowledge-identity)
- [ZK identity wallets for self-sovereign ID 2026 (OnChain Passport)](https://onchainpassport.org/2026/02/03/zk-identity-wallets-for-self-sovereign-id-zero-knowledge-proofs-in-decentralized-wallets-2026/)
- [Polygon ID — official launch announcement](https://polygon.technology/blog/introducing-polygon-id-zero-knowledge-own-your-identity-for-web3)
- [ZK-KYC primer (Mitosis University)](https://university.mitosis.org/zk-kyc-proving-you-are-verified-without-exposing-your-identity/)
