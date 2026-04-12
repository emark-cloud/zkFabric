# zkFabric — Demo Video Script (4 minutes)

**Format:** Fully pre-recorded screencast with voiceover, edited together
**Audience:** Hackathon judges, developers, and non-technical viewers
**Goal:** Show the complete flow from verification to private access, make the value proposition obvious, close with strong CTA

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

> "Right now, every app on HashKey Chain can see your full KYC status — your tier, your name, your verification date — all linked to your wallet. Every DeFi vault, every governance contract you use knows exactly who you are.
>
> But they don't *need* to know who you are. A lending app just needs to know you're creditworthy. A voting system just needs to know you're a real person. They need answers, not identities.
>
> That's the problem zkFabric solves."

---

### [0:30–0:50] SOLUTION INTRO
**Screen:** Scroll to "What dApps See" section on the landing page — the four use case cards showing DeFi lending, Governance, RWA vaults, PayFi, each with "YES. Identity: unknown." Then scroll to "Native to HashKey Chain" section.

> "zkFabric is a privacy layer for HashKey Chain. You get verified once, and from then on you can prove specific things about yourself — like 'I'm KYC level 3 or above' — without ever revealing your actual identity. Apps get a verified yes-or-no answer. They never learn who you are.
>
> Let me show you."

---

### [0:50–1:30] DEMO — IDENTITY + CREDENTIAL ISSUANCE
**Screen:** Issue page. Step indicator at top shows "Identity → KYC Source → Mint". Show wallet connect -> Create Identity -> mnemonic modal -> select KYC tier -> Mint Credential. Toast notifications confirm each action. Cut between steps to keep it tight (skip tx confirmations).

> "I start by connecting my wallet and creating a zkFabric identity. This gives me a 12-word recovery phrase — same idea as a wallet backup — so I can restore my identity on any device.
>
> Next I register my KYC level. On mainnet, this pulls directly from HashKey's existing KYC system. On testnet here, I pick PREMIUM tier.
>
> When I mint, my KYC details — tier, status, jurisdiction, timestamp — get cryptographically hashed and that hash is recorded on-chain. The actual data stays in my browser. The blockchain only knows that a valid credential exists, not what's in it."

**Screen highlight:** Show the CredentialCard appearing — it displays "KYC Credential" with human-readable fields: KYC Level = PREMIUM, Status = Active, Jurisdiction = Hong Kong, issued date.

---

### [1:30–2:10] DEMO — PROOF GENERATION
**Screen:** Prove page. Step indicator shows "Select Credential → Configure Predicates → Generate Proof". Select credential -> configure predicates -> generate proof. Show the 4-stage substep progress with spinners and checkmarks. Show the timer counting ~3 seconds.

> "Now the key part. I go to the Proof page and select my credential. Instead of dealing with technical parameters, I just pick from simple options — 'Minimum KYC Level: PREMIUM or higher', 'Account Status: Active only', 'Jurisdiction: Any'. Behind the scenes, these become zero-knowledge constraints that the proof will satisfy.
>
> I choose 'Gated Vault' as the target app. The system also creates a unique one-time token — called a nullifier — that prevents me from reusing this proof, but can't be traced back to my wallet.
>
> I hit Generate, and in about three seconds, a proof is created right here in my browser. No data is sent to any server. The result is a small piece of data that any smart contract can verify on-chain."

**Screen highlight:** Show the proof result appearing with the green "All Predicates Pass: YES" indicator.

---

### [2:10–2:40] DEMO — VAULT DEPOSIT (DeFi Consumer)
**Screen:** Vault page. Show dashboard with "Access Requirement: KYC PREMIUM+" card. Show token balance -> mint test tokens -> approve -> paste proof -> deposit. Toast notifications confirm each step.

> "Here's where it gets real. This is a token vault — the kind any DeFi protocol would use. But to deposit, you need to prove you're KYC-verified. The dashboard shows the requirement in plain language: 'KYC PREMIUM or higher.'
>
> I paste my proof, enter an amount, and submit. The vault's smart contract verifies the proof, checks it hasn't been used before, checks it hasn't been revoked, and if everything passes — the deposit goes through. The vault knows I'm qualified. It has *no idea* who I am.
>
> For developers, the integration is about 30 lines of code. One function call."

---

### [2:40–3:00] DEMO — GOVERNANCE VOTE (Second Consumer)
**Screen:** Governance page. Create a new proposal (the page starts with an empty state: "No proposals yet"). Type a proposal description -> create -> generate proof with governance scope -> paste proof -> vote YES. Toast confirms vote cast.

> "The same credential works across different apps. Here's anonymous governance — I create a proposal, generate a fresh proof for this specific vote, and cast my ballot.
>
> Because each app gets its own scope, my vault deposit and my vote can't be linked together. No one can tell it's the same person. But if I try to vote twice on the same proposal, the system catches it. One person, one vote — with complete privacy."

---

### [3:00–3:20] DEMO — REVOCATION
**Screen:** Revoke page. Show credential list from indexer -> click Revoke -> confirmation dialog appears ("This will permanently revoke...") -> confirm -> toast confirms revocation -> credential shows red "Revoked" badge.

> "What if someone's KYC gets revoked, or a credential is compromised? The issuer clicks Revoke, confirms the action, and from that moment on, every app on the network automatically rejects proofs tied to that credential. No app-by-app updates needed — it's enforced across the entire ecosystem instantly.
>
> In production, revocation wouldn't be a single click — we've built a multisig contract that requires multiple authorized signers to approve any revocation or registry change. For the demo, permissions are open so you can see the full flow."

---

### [3:20–4:00] ARCHITECTURE RECAP + CTA
**Screen:** Scroll through the landing page "Under the Hood" section (6 tech items), then transition to the Deployed Contracts table in README, then the SDK integration code snippet.

> "Under the hood, zkFabric has four layers. First, credential adapters that read from HashKey's KYC system and off-chain sources. Second, a private identity registry with seed-phrase recovery. Third, a proof engine that runs entirely in the user's browser — no trusted server. And fourth, an on-chain verifier with built-in replay protection and revocation.
>
> For governance, we've built an M-of-N multisig contract — in production, any admin action like updating the identity tree or revoking a credential requires approval from multiple signers. No single point of control.
>
> We've deployed ten contracts on HashKey Chain Testnet, all verified and open-source. Sixty-five automated tests passing. Plus a TypeScript SDK, a live event indexer, and a backend for off-chain attestations.
>
> For any developer building on HashKey Chain — adding private identity checks is one function call. Your users prove they qualify without ever revealing who they are.
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
