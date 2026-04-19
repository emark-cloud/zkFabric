# zkFabric — Final Pitch Deck

> Solo pitch · 7 minutes total · no Q&A · HashKey Chain Horizon Hackathon final, Web3 Festival HK, 2026-04-23.
>
> Format: each slide carries a target time, a visual description, the on-slide elements, the spoken script, and a delivery note. Total spoken time targets ~6:50 leaving a 10s buffer.

---

## Pacing summary

| # | Slide | Target | Running |
|---|---|---|---|
| 1 | Hook + the three failures | 0:45 | 0:45 |
| 2 | Why now — Hong Kong's tokenisation moment | 0:40 | 1:25 |
| 3 | What zkFabric is & how it works | 0:35 | 2:00 |
| 4 | Architecture & data flow | 0:50 | 2:50 |
| 5 | Key tech choices | 0:25 | 3:15 |
| 6 | How zkFabric fits HashKey — today & tomorrow | 1:00 | 4:15 |
| 7 | Differentiators | 0:25 | 4:40 |
| 8 | Who benefits + 100-line developer integration | 0:40 | 5:20 |
| 9 | Limitations, mitigations, roadmap | 0:25 | 5:45 |
| 10 | Live demo — issue → prove → deposit | 1:15 | 7:00 |
| 11 | Closing vision | 0:10 | 7:10 |

Demo slot is 75s; if it runs long, cut the closing vision to a single sentence over the final demo screen and skip slide 11.

---

## Slide 1 — Hook + The Three Failures

**Time:** 0:45

**Visual:**
- Full-bleed dark background.
- Top half: a stylised KYC card with personal fields (name, DOB, passport number, address) all visible. A red strikethrough across the whole card.
- Bottom half-line in large type: "Web3 identity is broken in three ways."
- Three sub-icons across the bottom: 📤 (leak), 🧱 (silo), 🧩 (no standard).

**On-slide text:**
> **Web3 identity leaks too much, lives in silos, and has no standard.**
>
> Binary KYC · Siloed credentials · No `npm install` for it

**Script:**
> "Every user on HashKey Chain who connects their KYC SBT to a dApp today is leaking more than they need to. The SBT exposes their tier, their status, their ENS-bound name — to anyone who reads the chain. dApps don't need to know **who** you are. They need to know **what you qualify for.**
>
> That's failure number one: binary KYC is a privacy failure.
>
> Number two: the credential you got from HashKey Exchange can't carry into a DeFi vault. Every dApp builds its own identity silo.
>
> Number three: every team at this hackathon — including this one — is shipping their own bespoke verifier. There is no `npm install zkid` for HashKey. So most teams ship nothing, and binary KYC stays the default."

**Delivery note:** Open hard. No "hi I'm…". The first word should be "Every." Stake is set in 10 seconds.

---

## Slide 2 — Why Now: Hong Kong's Tokenisation Moment

**Time:** 0:40

**Visual:**
- A vertical timeline on the right edge. Three dots:
  - "1 Aug 2025 — Stablecoins Ordinance in force"
  - "Early 2026 — First HK regulated silver-backed RWA on HashKey Chain"
  - "H2 2026 — Coinbase + Nasdaq tokenised stocks (Xiao Feng's pivot)"
- Left: a venn diagram with two circles labelled **COMPLIANCE** and **PRIVACY**, intersection labelled **ZK** with a glow.

**On-slide text:**
> The compliance/privacy paradox is now operational, not theoretical.
>
> HKMA Stablecoins Ordinance · SFC tokenised securities · PDPO data minimisation
>
> The only resolution is cryptographic.

**Script:**
> "The reason this matters today and not next year: Hong Kong's regulatory window has actually opened. The Stablecoins Ordinance came into force last August. The first regulated silver-backed RWA token launched on HashKey Chain a few weeks ago. Dr. Xiao Feng has called the second half of this year the pivot — when Coinbase and Nasdaq launch tokenised stocks and the on-chain financial system becomes real.
>
> Every one of those flows requires KYC, accreditation, jurisdiction enforcement, sanctions screening — at the smart contract level.
>
> But Hong Kong's PDPO and the data minimisation principle won't let issuers put that data on-chain in the clear. Compliance and privacy pull in opposite directions. Zero-knowledge proofs are the only known cryptographic resolution."

**Delivery note:** Slow down on "the only known cryptographic resolution." This is the structural argument the rest of the talk leans on.

---

## Slide 3 — What zkFabric Is, and How It Works

**Time:** 0:35

**Visual:**
- Centered, very large: **zkFabric**
- Subtitle in italic grey: *Verify once. Prove anything. Reveal nothing.*
- Below: three boxes side by side with arrows pointing to a single output:
  - `KYC SBT` → `[zkFabric]` → `proof`
  - `zkTLS attestation` → `[zkFabric]` → `proof`
  - `On-chain activity` → `[zkFabric]` → `proof`
- Output arrow leads into a dApp icon labelled `verify(proof) → ✓`.

**On-slide text:**
> **zkFabric is a selective-disclosure identity router for HashKey Chain.**
>
> Many credential sources → one circuit → one verifier → any dApp.

**Script:**
> "zkFabric is a selective-disclosure identity router. One sentence: it turns HashKey's native KYC SBT — and any other credential source — into zero-knowledge proofs that any dApp can verify on-chain.
>
> Here's the mechanism. A user verifies once. The credential is stored as a Poseidon hash commitment in a Merkle tree on HashKey Chain. When a dApp needs to gate access, the user generates a Groth16 proof in their browser — about three seconds — that proves a specific predicate over their credential, like 'KYC tier is at least 3' or 'jurisdiction is Hong Kong, US, or UK.'
>
> The dApp learns the predicate is true. It learns nothing else."

**Delivery note:** "Verify once. Prove anything. Reveal nothing." Land each phrase. This is the line the audience should remember.

---

## Slide 4 — Architecture & Data Flow

**Time:** 0:50

**Visual:**
- Four-layer horizontal stack diagram (left to right):
  1. **Credential Adapters** (icons: KYC SBT, zkTLS, on-chain)
  2. **Identity Registry** (Merkle tree icon, depth 20)
  3. **Proof Engine** (Circom + Groth16 logo)
  4. **Verification Layer** (smart contract icon with check + revocation badge)
- Below: thin band labelled **HashKey Chain (EVM, Chain ID 177)**.
- Bottom-right corner small annotation: "9,993 constraints · ~3s client-side proof · ~200K gas verify"

**On-slide text:**
> Adapters → Registry → Proof → Verifier
>
> Universal 8-slot credential schema · 5 predicate operators · per-scope nullifiers · on-chain revocation

**Script:**
> "Four layers. Adapters ingest credentials from three sources today and pack them into a universal 8-slot schema — that's the unlock that lets one circuit handle every credential type. The registry is a Poseidon Merkle tree of credential commitments, on-chain root, fully reconstructable from events. The proof engine is a custom Circom circuit, just under 10,000 constraints, generating Groth16 proofs in the browser in around three seconds. The verifier is a single contract that checks the proof, the Merkle root, the nullifier, and revocation status — atomically.
>
> The dApp makes one SDK call. Everything else is invisible."

**Delivery note:** Move your hand or laser left to right across the four boxes as you speak. Land "atomically" with emphasis — it's a load-bearing word for any judge with a security background.

---

## Slide 5 — Key Tech Choices and Why

**Time:** 0:25

**Visual:**
- Four-row table, sparse:

| Choice | Why |
|---|---|
| **Groth16** | Cheapest EVM verification (~200K gas) |
| **Custom Poseidon identity** | Simpler than Semaphore EdDSA, fewer constraints |
| **Standard binary IMT depth 20** | No LeanIMT/Circom impedance mismatch |
| **BIP39 + event-sourced indexer** | No single-device point of failure |

**On-slide text:** Table only.

**Script:**
> "Four decisions worth defending. Groth16 because HashKey users pay HSK gas — we optimise verification cost first. Custom Poseidon identity, not Semaphore's EdDSA scheme, because credential circuits don't need a signature primitive — fewer constraints, simpler tooling. Standard binary Merkle tree because LeanIMT has no official Circom template and we don't want an audit hazard. And BIP39 mnemonic recovery plus an event-sourced indexer — so losing your laptop doesn't brick your credentials."

**Delivery note:** Fast pace. The audience doesn't need to absorb all four — they need to register that defensible technical choices were made.

---

## Slide 6 — How zkFabric Fits HashKey: Today & Tomorrow

**Time:** 1:00

**Visual:**
- Split screen.
- **Left half — TODAY:** stack diagram showing the HashKey ecosystem with the KYC SBT at the bottom. zkFabric sits as a **highlighted middle layer** between the SBT and a row of Atlas Grant-style dApps (DeFi, PayFi, RWA, Governance).
- **Right half — TOMORROW:** four use-case cards mapped one-to-one with HashKey's strategic pillars:

| HashKey pillar | zkFabric unlock |
|---|---|
| **RWA tokenisation** | Accreditation + jurisdiction proofs without leaking holders |
| **PayFi (FRS stablecoins)** | Sanctions + jurisdiction screening as a ZK predicate |
| **BTCFi** | Permissioned LP pools with privacy preservation |
| **AI + on-chain data** | Anonymous-but-attributable agent credentials |

**On-slide text:**
> **HashKey already has the regulated identity primitive.**
> **zkFabric is the layer that makes every dApp on the chain able to use it — privately, composably, and natively.**

**Script:**
> "This is the part I want you to remember. HashKey has done the hard regulatory work — the SFC licences, the HKMA stablecoin pipeline, the 600,000-user KYC base, the native KYC SBT contract. None of that pays off unless dApps can actually consume it without breaking privacy law.
>
> Today, zkFabric is the missing layer between HashKey's KYC SBT and the Atlas Grant ecosystem. A grantee building an RWA vault, a PayFi rail, a permissioned BTCFi pool — they integrate zkFabric in 100 lines of code instead of building bespoke ZK infrastructure. That's the entire point of a $50 million ecosystem programme: lower the integration cost so capital lands faster.
>
> Tomorrow, every one of HashKey's four strategic pillars consumes this layer. Tokenised securities need accreditation proofs. Stablecoin rails need sanctions screening. Permissioned pools need compliant LPs. Agent infrastructure needs anonymous-but-attributable identities.
>
> HashKey already has the regulated identity primitive. zkFabric is the layer that makes every dApp on the chain able to use it — privately, composably, and natively."

**Delivery note:** This is the killer slide. Slow down. Land the closing line word-by-word. If you only have one quotable sentence in the whole pitch, it's this one.

---

## Slide 7 — Differentiators

**Time:** 0:25

**Visual:**
- Three vertical columns, equal width, each with a one-word headline and one supporting line.

| 🔀 **Universal schema** | 🏗️ **Complete infra** | 🔌 **Drop-in SDK** |
|---|---|---|
| 8 slots, one circuit, every credential source | Indexer · Attestor · Recovery · Multisig · Revocation | 60 lines Solidity, 40 lines TypeScript |

**On-slide text:** Three-column layout above.

**Script:**
> "Three things that are hard to copy. One: the 8-slot universal schema — that's the design choice that makes one circuit handle every credential source. Two: complete infrastructure — most ZKID submissions ship a verifier and a demo screen. We ship a verifier, an indexer, an attestor, BIP39 recovery, on-chain revocation, and a multisig governance contract. Three: a 100-line integration. Other ZK identity stacks are heavyweight; ours is a drop-in."

**Delivery note:** Hit each column header crisply. Don't elaborate beyond the line beneath each.

---

## Slide 8 — Who Benefits + Developer Integration

**Time:** 0:40

**Visual:**
- Top half: three-row "who benefits" map.

| Audience | What they get |
|---|---|
| **Users** | One KYC, infinite dApps, zero data exposed |
| **dApp builders** | Compliant gating in 100 LOC instead of months of ZK work |
| **HashKey ecosystem** | Privacy-preserving composability across all 4 pillars |

- Bottom half: a Solidity code excerpt — the integration is the proof point.

```solidity
function deposit(uint256 amount, uint256[8] calldata proof, uint256[] calldata signals) external {
    zkFabric.verifyAndRecord(proof, signals, SCOPE);   // <- entire identity check
    _processDeposit(msg.sender, amount);
}
```

**On-slide text:** Table + code block above.

**Script:**
> "Three audiences benefit immediately. Users get one verification reused across every dApp on the chain, with nothing leaked beyond the predicate they're proving. Builders get compliant identity gating in around 100 lines of code instead of months of ZK engineering. The HashKey ecosystem gets composable privacy across every Atlas Grant track.
>
> And the integration is genuinely one line. This is the entire identity check inside a gated vault contract. One call to `verifyAndRecord` and the contract is finished gating — zkFabric handles the proof, the Merkle root, the nullifier, and the revocation status. Builders ship their actual product, not their identity stack."

**Delivery note:** Point at the highlighted line of the code excerpt. The visual proof of the "drop-in" claim from the previous slide.

---

## Slide 9 — Limitations, Mitigations, Roadmap

**Time:** 0:25

**Visual:**
- Two-column layout.
- Left column: **"What's not done yet"** with three lines.
- Right column: **"How we close the gap"** with three matching lines.

| Limitation | Mitigation |
|---|---|
| Single-contributor trusted setup | Multi-party ceremony before mainnet |
| No third-party audit | Two firms in conversation |
| Testnet only | Mainnet deployment + 3 RWA issuer integrations Q3 |

**On-slide text:** Table only.

**Script:**
> "Honest limitations. The Groth16 trusted setup was single-contributor for the hackathon — production needs a multi-party ceremony, the same way Zcash and Tornado handled it. We have no third-party audit yet — talking to two firms. And we're testnet only — mainnet deployment and three RWA issuer integrations are the Q3 roadmap. Cross-chain proof relay and a mobile SDK are next year."

**Delivery note:** Don't apologise for the gaps. Frame them as the credible work plan of a team that knows what production looks like.

---

## Slide 10 — Live Demo: Issue → Prove → Deposit

**Time:** 1:15 (75 seconds)

**Visual:**
- Switch to live browser tab at `zk-fabric.vercel.app`.
- Pre-staged setup (do BEFORE pitch starts):
  - Wallet already connected
  - KYC SBT already minted on testnet
  - Credential already ingested into the registry
  - Browser left on the **Prove** page with predicates pre-selected
  - Vault contract already approved for the mUSDC spend
- This way the demo starts at "generate proof" — the visual is the cool part.

**Demo sequence (rehearse this sub-90s):**

1. **(5s)** "I'm on the Prove page. My credential is already issued — KYC tier 4, jurisdiction Hong Kong. The vault I'm depositing into requires tier ≥ 3 and a Hong Kong, US, or UK jurisdiction." Point at the predicate dropdowns.
2. **(10s)** Click **Generate Proof.** Show the substep progress: building witness → running snarkjs → formatting for chain.
3. **(8s)** Proof completes. "Three seconds, fully in-browser. Now look at what's about to be sent on-chain." Briefly show the public signals — point out that the tier and jurisdiction values are NOT in there. Only the predicate result is.
4. **(15s)** Switch to the **Vault** page. Click **Deposit with Proof**. MetaMask popup → confirm. Wait for confirmation.
5. **(15s)** Once the tx confirms, show the vault dashboard balance update. Then click straight to the Blockscout link in the tx receipt.
6. **(10s)** On the explorer: scroll to the event log. "There's the `Deposit` event. There's the `nullifier` — unique to me, this scope. Nowhere on this transaction does it say what my KYC tier is, or what country I'm in, or which wallet on HashKey Exchange I came from. The contract knows I qualify. It learns nothing else."
7. **(2s)** Cut back to the closing slide.

**On-slide text (only when not in browser):** "Live: zk-fabric.vercel.app · Contracts: HashKey Chain Testnet (Chain 133)"

**Delivery note:** This is the riskiest 75 seconds of the pitch. Three rules: (1) **everything is pre-staged** so you start at the dramatic step; (2) **never wait silently for a transaction** — narrate while it's pending; (3) **if anything fails, cut immediately to the closing slide** — don't troubleshoot live.

**Backup plan:** If the demo breaks, switch instantly to the demo video timestamp [`youtu.be/RnBgjBLLtH8?t=XX`](https://youtu.be/RnBgjBLLtH8) — have the URL bookmarked. Say: "Network's flaky — same flow, recorded yesterday." Lose 5 seconds, save the pitch.

---

## Slide 11 — Closing Vision

**Time:** 0:10

**Visual:**
- Single line, centered, large type, on a clean dark background.
- Below it, a single line of metadata: deployed contracts count, test count, links.

**On-slide text:**
> **Every regulated dApp on HashKey Chain — gated by zero knowledge, by default.**
>
> 10 contracts live on testnet · 65/65 tests · BIP39 recoverable · zk-fabric.vercel.app

**Script:**
> "The vision is simple. Every regulated dApp on HashKey Chain — gated by zero knowledge, by default. That's the layer that makes the chain's regulatory advantage actually compose. Thank you."

**Delivery note:** Pause one beat after "by default." Then "Thank you" and stop. Don't over-explain.

---

# Appendix — Reference material for slide design

## Visual style guide (consistent across deck)

- **Palette:** dark navy background (#0A0E27 or HashKey Chain brand dark), white/light grey body text, single accent colour for highlights — use HashKey teal/cyan (#00B4D8 or similar) or HSK token brand colour.
- **Typography:** one sans-serif throughout (Inter, Geist, or similar), heavy weights for headlines, light weight for body.
- **Diagram style:** flat, monoline, no skeuomorphism. Boxes with thin borders, arrows with single weight.
- **Code:** monospace (JetBrains Mono / Geist Mono), syntax-highlighted on a darker block background.
- **No stock photos.** No "guy in suit shaking hands." No abstract blockchain graphics. Diagrams or text only.

## Speaker delivery notes (apply throughout)

- **Open standing still.** Do not pace until slide 4.
- **Look at the judges, not the screen.** Glance back at the screen only when transitioning slides.
- **The clicker is your timing tool.** Practice with it — every advance should feel intentional, not nervous.
- **Hands open and visible.** No pockets, no podium-grip.
- **Pace:** ~150 words/min average. Slow down for the load-bearing lines (slide 2's "only known cryptographic resolution," slide 6's closing line, slide 11's vision).

## Anticipated objections built into the script

Even though there's no Q&A, judges will be writing notes. The script pre-empts the four most likely objections:

1. *"Why not BBS+?"* — addressed implicitly on slide 5 ("simpler than Semaphore").
2. *"What about trusted setup?"* — addressed openly on slide 9.
3. *"Is this just Semaphore with extra steps?"* — addressed on slides 4 and 5 (custom identity + multi-source schema).
4. *"What if HashKey ships its own?"* — addressed implicitly on slide 6 ("the layer that makes every dApp able to use it").

## Pre-pitch checklist (run 30 min before)

- [ ] Vercel deployment loaded and warm — ping `zk-fabric.vercel.app` from the demo machine
- [ ] HashKey testnet RPC reachable from venue Wi-Fi (test once)
- [ ] Wallet connected, MetaMask unlocked
- [ ] Test wallet has HSK for gas + mUSDC for vault deposit
- [ ] KYC SBT already minted on the test wallet
- [ ] Credential already issued and indexed
- [ ] Vault page pre-loaded in a second tab
- [ ] Demo video tab open and timestamped, ready as fallback
- [ ] Browser zoom set to 125-150% so judges can read from the back
- [ ] Notifications silenced (system + browser)
- [ ] Slides loaded in presenter mode with timer running
- [ ] Phone on silent

## What NOT to say

- "Disrupting…" or "revolutionising…" — judges have heard it 200 times today
- "AI-powered" anywhere — not relevant, will lose trust
- Apologies for what's missing — the limitations slide handles it cleanly
- Reading slide bullets verbatim — paraphrase the on-slide text, don't recite
- Mentioning prize money or "thank you for the opportunity" — wastes seconds
