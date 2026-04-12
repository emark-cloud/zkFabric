# zkFabric — Demo Video Script (4 minutes)

**Format:** Fully pre-recorded screencast with voiceover, edited together
**Audience:** Mixed technical (hackathon judges + developer audience)
**Goal:** Show the complete credential lifecycle, make it clear how HashKey Chain dApps benefit, close with strong CTA

---

## Timing Budget

| Section | Duration | Cumulative |
|---------|----------|------------|
| Hook + Problem | 0:00–0:30 | 30s |
| Solution intro | 0:30–0:50 | 50s |
| Demo: Identity + KYC | 0:50–1:30 | 1:30 |
| Demo: Proof generation | 1:30–2:10 | 2:10 |
| Demo: Vault deposit | 2:10–2:40 | 2:40 |
| Demo: Governance vote | 2:40–3:00 | 3:00 |
| Demo: Revocation | 3:00–3:20 | 3:20 |
| Architecture recap + CTA | 3:20–4:00 | 4:00 |

---

## SCRIPT

### [0:00–0:30] HOOK + PROBLEM
**Screen:** Landing page hero ("Prove you qualify without revealing who you are"), then scroll down to "The Problem" section showing the three cards: Binary KYC, Siloed credentials, No standard. Quick cut to Blockscout showing a `getKycInfo` call returning full user data.

> "Every dApp on HashKey Chain can read your KYC status right now — your tier, your ENS name, your verification date, all tied to your wallet address. That means every DeFi protocol, every vault, every governance contract you interact with knows exactly who you are.
>
> But here's the thing — they don't *need* to know who you are. A lending protocol just needs to know you're creditworthy. A governance system just needs to know you're a unique human. They need answers, not identities.
>
> That's what zkFabric does."

---

### [0:30–0:50] SOLUTION INTRO
**Screen:** Scroll to "What dApps See" section on the landing page — the four use case cards showing DeFi lending, Governance, RWA vaults, PayFi, each with "YES. Identity: unknown." Then scroll to "Native to HashKey Chain" section.

> "zkFabric is a privacy layer for HashKey Chain. It turns your KYC — or any verified credential — into a zero-knowledge proof. You prove you qualify without revealing who you are. One SDK call, one verifier contract, and any dApp on HashKey Chain gets compliant identity checks with zero privacy leakage.
>
> Let me show you how it works."

---

### [0:50–1:30] DEMO — IDENTITY + CREDENTIAL ISSUANCE
**Screen:** Issue page. Step indicator at top shows "Identity → KYC Source → Mint". Show wallet connect -> Create Identity -> mnemonic modal -> select KYC tier -> Mint Credential. Toast notifications confirm each action. Cut between steps to keep it tight (skip tx confirmations).

> "First, I connect my wallet and create a zkFabric identity. This generates a 12-word recovery phrase — just like a wallet seed — that I can use to restore my identity on any device. The identity commitment is a Poseidon hash. No one can reverse it to find my private key.
>
> Now I register my KYC. On mainnet, this reads directly from HashKey's KYC SBT contract — the same `getKycInfo` every dApp already uses. Here on testnet, I select PREMIUM tier.
>
> When I mint, the SDK packs my KYC data into 8 private credential slots — tier, status, jurisdiction, timestamp — hashes them with Poseidon, and registers that hash on-chain. The actual data never leaves my browser. The on-chain registry just records that a valid credential exists."

**Screen highlight:** Show the CredentialCard appearing — it displays "KYC Credential" with human-readable fields: KYC Level = PREMIUM, Status = Active, Jurisdiction = Hong Kong, issued date. No raw numbers.

---

### [1:30–2:10] DEMO — PROOF GENERATION
**Screen:** Prove page. Step indicator shows "Select Credential → Configure Predicates → Generate Proof". Select credential -> configure predicates -> generate proof. Show the 4-stage substep progress (Preparing Merkle proof → Computing witness → Generating Groth16 → Finalizing) with spinners and checkmarks. Show the timer counting ~3 seconds.

> "Now the interesting part. I go to the Proof Composer and select my credential. Instead of configuring raw circuit parameters, I just pick from plain-language options — 'Minimum KYC Level: PREMIUM+', 'Account Status: Active only', 'Jurisdiction: Any'. The app translates these into zero-knowledge predicates under the hood. I don't reveal my exact tier, my name, or anything else. Just: 'I qualify.'
>
> I select 'Gated Vault' as the target dApp — you can see the green label confirming it. This also generates a nullifier — a one-time pseudonym that prevents me from using this proof twice, but can't be linked back to my wallet.
>
> I hit Generate, and in about three seconds, a Groth16 zero-knowledge proof is computed right here in my browser. No server, no backend. The output is a small JSON blob — 8 proof elements and 52 public signals — that any smart contract can verify on-chain for about 200K gas."

**Screen highlight:** Show the proof result appearing with the green "All Predicates Pass: YES" indicator, nullifier hash, and Merkle root.

---

### [2:10–2:40] DEMO — VAULT DEPOSIT (DeFi Consumer)
**Screen:** Vault page. Show dashboard with "Access Requirement: KYC PREMIUM+" card. Show token balance -> mint test tokens -> approve -> paste proof -> deposit. Toast notifications confirm each step.

> "Here's where a dApp uses the proof. This is a standard ERC-4626 tokenized vault — the kind any DeFi protocol on HashKey would use. But deposits require a ZK proof. Notice the dashboard shows the access requirement in plain language: 'KYC PREMIUM+' — not a raw scope number.
>
> I paste my proof, enter a deposit amount, and submit. The vault contract calls *one function*: `zkFabric.verifyAndRecord`. That single call checks the Groth16 proof, validates the Merkle root, records the nullifier, and checks revocation status. If it passes, the deposit goes through. The vault knows I'm KYC-verified at PREMIUM tier — but it has *no idea* who I am.
>
> The integration? About 30 lines of Solidity. Import the interface, call `verifyAndRecord`, done."

---

### [2:40–3:00] DEMO — GOVERNANCE VOTE (Second Consumer)
**Screen:** Governance page. Create a new proposal (the page starts with an empty state: "No proposals yet — Create a proposal above to start anonymous governance"). Type a proposal description -> create -> generate proof with governance scope -> paste proof -> vote YES. Toast confirms vote cast.

> "The same credential powers a completely different dApp. This is anonymous governance — I create a proposal, generate a new proof scoped to this specific proposal, and cast my vote.
>
> Because the scope is different, I get a different nullifier. That means my vault deposit and my governance vote are *cryptographically unlinkable*. No one can tell it's the same person. But if I try to vote twice on the same proposal, the nullifier collision blocks me. One person, one vote — no wallet linking, no identity exposure."

---

### [3:00–3:20] DEMO — REVOCATION
**Screen:** Revoke page. Description in plain language (no contract names). Show credential list from indexer -> click Revoke -> confirmation dialog appears ("This will permanently revoke...") -> confirm -> toast confirms revocation -> credential shows red "Revoked" badge.

> "Finally, revocation. If a user's KYC is revoked — or a credential is compromised — the issuer clicks Revoke. A confirmation dialog prevents accidental revocations. From that moment, every dApp that calls `verifyAndRecord` automatically rejects proofs built against that credential. No circuit changes, no per-dApp updates. It's enforced at the protocol layer, across the entire ecosystem, instantly."

---

### [3:20–4:00] ARCHITECTURE RECAP + CTA
**Screen:** Scroll through the landing page "Under the Hood" section (6 tech items: Groth16, Poseidon hash, 8-slot credentials, Nullifiers, BIP39 recovery, On-chain revocation), then transition to the Deployed Contracts table in README, then the SDK integration code snippet.

> "Let's zoom out. zkFabric has four layers: credential adapters that read HashKey's KYC SBT and off-chain data via zkTLS, a Poseidon-based identity tree with BIP39 recovery, a Groth16 proof engine that runs entirely client-side, and an on-chain verifier with built-in nullifier tracking and revocation.
>
> Ten contracts deployed and verified on HashKey Chain Testnet. Sixty-five tests passing. A TypeScript SDK, an event-sourced indexer, and a Reclaim Protocol attestor backend.
>
> For any dApp builder on HashKey Chain — the integration is one function call. You get compliance *and* privacy from a single line of Solidity. Your users prove they qualify without ever revealing who they are.
>
> zkFabric. Verify once. Prove anything. Reveal nothing."

---

## Recording Tips

1. **Record each section separately** — edit together for clean transitions. No need for one continuous take.
2. **Speed up wallet confirmations** — 2x or 3x speed with a subtle visual indicator ("confirming...") so viewers aren't watching spinners.
3. **Highlight key UI elements** — use a subtle zoom or cursor highlight when showing the proof result, predicate builder, and credential card.
4. **Keep the voiceover pace conversational** — not rushed. The 4-minute budget has ~30s buffer.
5. **Show Blockscout briefly** — when mentioning "10 contracts deployed and verified," flash the explorer for 2-3 seconds. It's credibility.
6. **End screen** — GitHub repo URL, hackathon badge, "Built for HashKey Chain On-Chain Horizon Hackathon 2026."

---

## Pre-Recording Checklist

- [ ] Clear browser localStorage (fresh start for clean demo)
- [ ] Start indexer service (`cd indexer && REGISTRY_ADDRESS=0x93415BCDbAda30f06274c32fE7b713bF9AB460C1 npm run dev`)
- [ ] Start attestor service (`cd attestor && ATTESTOR_PRIVATE_KEY=0x... ATTESTOR_DEV_MODE=1 npm run dev`)
- [ ] Start Next.js dev server (`cd app && npm run dev`)
- [ ] Have MetaMask connected to HashKey Chain Testnet (Chain 133)
- [ ] Ensure wallet has testnet HSK for gas
- [ ] Test the full flow once before recording
- [ ] Have Blockscout open in a separate tab for the hook shot
