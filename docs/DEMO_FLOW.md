# zkFabric Demo Flow — Step-by-Step

A detailed walkthrough of every step in the zkFabric demo, covering exactly what happens on-chain and off-chain, and how each step maps to real dApp use cases on HashKey Chain.

---

## Step 1: Connect Wallet & Create Identity

**What happens:**
- User connects their MetaMask (or any EVM wallet) to the zkFabric frontend via RainbowKit
- They click "Create Identity" which generates a **12-word BIP39 mnemonic** (like a wallet seed phrase)
- From that mnemonic, a **private key** is derived (a random number in the BN128 field)
- The **identity commitment** is computed: `Poseidon(privateKey)` — a one-way hash that represents the user without revealing the key
- The mnemonic is shown once in a modal; the user must acknowledge they've backed it up

**What's stored where:**
- Mnemonic + private key + commitment -> browser localStorage (scoped to wallet address)
- Nothing goes on-chain yet

**Why it matters:**
- The private key is the root of all proofs. Knowing it = being able to prove you're you.
- The mnemonic makes the identity **recoverable** — lose your browser, restore from 12 words on any device, get the exact same identity back.
- The identity commitment is a public identifier that reveals nothing about the private key (Poseidon is a one-way hash).

**How dApps use this:**
- dApps never see the private key or mnemonic. They only ever see the identity commitment (if they're an adapter registering credentials), or nothing at all (if they're a consumer verifying proofs). The user manages their own identity entirely client-side.

---

## Step 2: Register KYC (or bring off-chain data)

There are two paths here — both end with the same result: an 8-slot credential.

### Path A: KYC SBT (on-chain data)

**What happens:**
1. User selects a KYC tier (BASIC/ADVANCED/PREMIUM/ULTIMATE) on the Issue page
2. Frontend calls `MockKycSBT.setKycInfo(address, ensName, level, status)` — this simulates having completed HashKey's real KYC process. On mainnet, this data would already exist from the user's actual KYC verification.
3. Frontend reads back `getKycInfo(address)` to confirm: level, status, ENS name, creation time

**What this means for HashKey:**
- HashKey Chain already has a KYC SBT system where every verified user gets a soulbound token recording their KYC level. zkFabric reads that existing data directly — it doesn't replace KYC, it wraps it in privacy.

### Path B: zkTLS Attestation (off-chain data)

**What happens:**
1. Frontend sends a request to the **attestor service** (`POST /attest`) with the user's address and identity commitment
2. The attestor verifies the claim via Reclaim Protocol (zkTLS — proves facts about web2 accounts like "GitHub account older than 2 years" by intercepting TLS sessions)
3. The attestor signs the result with its ECDSA private key
4. Frontend calls `ZKTLSAdapter.submitAttestation(user, commitment, attestationData, signature)` on-chain
5. The adapter verifies the signature matches the trusted attestor address, then records the attestation

**What this means for HashKey:**
- Not all useful identity data lives on-chain. Credit scores, social reputation, employment status — these exist on web2 platforms. zkTLS brings them into the system without the user ever sharing their web2 credentials with anyone. The attestor sees only the verified claim, not the user's login.

---

## Step 3: Mint Credential (pack data into 8 slots + register on-chain)

**What happens:**
1. The SDK takes the verified data (KYC or zkTLS) and packs it into **8 numbered slots**:
   ```
   KYC example:
   slot[0] = 1          (credential type: KYC)
   slot[1] = 3          (KYC level: PREMIUM)
   slot[2] = 1          (is active: yes)
   slot[3] = 1712345678 (verification timestamp)
   slot[4] = 344        (jurisdiction: Hong Kong)
   slot[5] = <issuerHash>
   slot[6] = 0          (reserved)
   slot[7] = 0          (reserved)
   ```

2. The SDK computes the **credential hash**: `Poseidon(identityCommitment, slot[0], slot[1], ..., slot[7])` — this is a single number that commits to the entire credential without revealing any slot value.

3. The credential hash is added to the local **Merkle tree** (a binary tree of depth 20 that can hold ~1 million credentials). The tree root changes.

4. Two on-chain transactions fire:
   - `KYCSBTAdapter.registerComputedCredential(commitment, credentialHash)` -> adapter calls `registry.registerCredential()` -> emits `CredentialRegistered` event
   - `ZKFabricRegistry.updateRoot(newRoot)` -> stores the new Merkle root on-chain in a rolling window of 100 roots

**What's stored where:**
- Slot values (the actual data) -> browser localStorage only. **Never on-chain.**
- Credential hash (a Poseidon hash that hides the data) -> on-chain in registry
- Merkle root (a single number representing the state of all credentials) -> on-chain in registry
- `CredentialRegistered` event -> on-chain log, picked up by the indexer

**Why the Merkle tree:**
- The circuit needs to prove "my credential is one of the registered credentials" without revealing which one. A Merkle tree does this: you prove your leaf is in the tree by providing a path of sibling hashes from leaf to root. The verifier only sees the root (which is public) and confirms the math checks out. The tree has depth 20, meaning it can hold 2^20 (approximately 1 million) credentials, and each proof requires only 20 hash operations.

**How dApps use this:**
- dApps don't interact with this step at all. It's between the user and the registry. The dApp only cares about the proof that comes later.

---

## Step 4: Generate ZK Proof (the core privacy step)

**What happens:**
1. User navigates to the Prove page, selects a credential, and configures **predicates** — the conditions they want to prove:
   - Example: "slot[1] >= 3" means "my KYC level is at least PREMIUM"
   - Example: "slot[4] IN {344, 840}" means "my jurisdiction is Hong Kong or US"
   - The user chooses what to reveal. Slots without predicates reveal nothing.

2. User selects a **scope** — a number that identifies which dApp/action the proof is for:
   - Gated Vault scope: `keccak256("zkfabric-gated-vault-v1") % BN128_PRIME`
   - Governance proposal 0 scope: `keccak256("zkfabric-governance-v1", 0) % BN128_PRIME`

3. The SDK builds the circuit input and generates a **Groth16 proof** in the browser (~2-4 seconds via WebAssembly). The circuit proves all five things simultaneously:

   **a) Identity ownership** — `Poseidon(privateKey) == identityCommitment`
   The prover knows the private key behind this identity.

   **b) Credential binding** — `Poseidon(identityCommitment, slots[0..7]) == credentialHash`
   These specific slot values belong to this identity's registered credential.

   **c) Merkle membership** — The credential hash is a leaf in the tree whose root matches the on-chain root.
   This credential is actually registered, not fabricated.

   **d) Nullifier correctness** — `Poseidon(privateKey, scope) == nullifierHash`
   This is a unique, deterministic pseudonym for this identity+scope combination.

   **e) Predicate satisfaction** — All slot conditions pass.
   The actual values satisfy the requirements.

4. The output is a **proof object** (8 numbers) and **52 public signals**:
   ```
   signals[0]     = 1 (all predicates pass)
   signals[1]     = merkleRoot
   signals[2]     = nullifierHash
   signals[3]     = scope
   signals[4-11]  = predicate types (e.g., [0, 2, 0, 0, 0, 0, 0, 0])
   signals[12-19] = predicate values (e.g., [0, 3, 0, 0, 0, 0, 0, 0])
   signals[20-51] = predicate sets (for IN_SET predicates)
   ```

**What the verifier (dApp) sees:**
- That all predicates passed — but not the actual slot values
- The Merkle root — confirms the credential is registered, but not which credential
- The nullifier hash — a pseudonym unique to this user+scope, but unlinkable to the user's wallet or identity
- The scope — confirms the proof was generated for this specific dApp
- The predicate types and thresholds — e.g., "slot 1 >= 3" — but NOT that slot 1 is actually 4

**What the verifier does NOT see:**
- The user's private key
- The identity commitment
- Any raw slot value
- Which credential in the tree belongs to this user
- Any link to proofs generated for other scopes

**How dApps use this:**
- The user copies the proof JSON from the Prove page and pastes it into the dApp's UI. In a production integration, the dApp's frontend would call the SDK directly to generate the proof inline — no copy-paste needed.

---

## Step 5: Vault Deposit (DeFi consumer example)

**What happens:**
1. User navigates to the Vault page, which shows their MockERC20 token balance
2. They mint test tokens and approve the vault to spend them
3. They paste the proof JSON (generated with the Gated Vault scope) and specify a deposit amount
4. Frontend calls `GatedVault.depositWithProof(amount, receiver, proof, publicSignals)`

**What happens on-chain** (`GatedVault.sol:45-74`):
```
depositWithProof(assets, receiver, proof, publicSignals)
  |
  +-- zkFabric.verifyAndRecord(proof, publicSignals, SCOPE)
  |     |
  |     +-- Check publicSignals.length == 52
  |     +-- Check signals[3] == SCOPE (proof is for this vault)
  |     +-- Check signals[0] == 1 (all predicates passed)
  |     +-- Check nullifiers[signals[2]] == false (not used before)
  |     +-- Check registry.isValidRoot(signals[1]) (root is recent)
  |     +-- Check !revocation.isRootRevoked(signals[1]) (root not revoked)
  |     +-- Check !revocation.isNullifierRevoked(signals[2]) (nullifier not revoked)
  |     +-- Groth16 pairing check (the actual cryptographic verification, ~200k gas)
  |     +-- Record nullifiers[signals[2]] = true
  |     +-- Emit ProofVerified, NullifierRecorded
  |
  +-- Read predicateTypes[1] and predicateValues[1] from signals
  |   If type == GREATER_EQUAL and value >= 3 -> premium = true
  |
  +-- isVerified[msg.sender] = true
  +-- isPremium[msg.sender] = premium
  +-- Emit UserVerified(user, premium)
  |
  +-- ERC4626.deposit(assets, receiver) -> mint vault shares
```

**What this demonstrates for HashKey dApps:**

This is the pattern any DeFi protocol on HashKey Chain would use:

- **Lending protocols** — Gate borrowing on "user has at least ADVANCED KYC" without seeing the user's identity. Different tiers could get different collateral ratios.
- **DEXs** — Allow larger trades for higher KYC tiers. "slot[1] >= 2" lets ADVANCED+ users trade above a limit.
- **Yield vaults** — Premium vaults restricted to PREMIUM/ULTIMATE KYC, exactly like this demo.
- **RWA platforms** — Real-world asset tokenization requires jurisdictional compliance. "slot[4] IN {344, 840, 826}" proves the user is in an allowed jurisdiction without revealing which one.

**The integration cost:** The vault contract is 80 lines total. The key line is one function call: `zkFabric.verifyAndRecord(proof, publicSignals, SCOPE)`. Everything else is standard ERC-4626.

---

## Step 6: Governance Vote (privacy-preserving consumer example)

**What happens:**
1. Anyone can create a proposal on the Governance page (description + duration)
2. To vote, the user generates a proof with a **proposal-specific scope**: `keccak256("zkfabric-governance-v1", proposalId) % BN128_PRIME`
3. They paste the proof and choose Yes or No
4. Frontend calls `PrivateGovernance.vote(proposalId, choice, proof, publicSignals)`

**What happens on-chain** (`PrivateGovernance.sol:42-78`):
```
vote(proposalId, choice, proof, publicSignals)
  |
  +-- Check proposal exists and voting hasn't ended
  +-- Compute scope = keccak256("zkfabric-governance-v1", proposalId) % BN128
  |
  +-- zkFabric.verifyAndRecord(proof, publicSignals, scope)
  |     +-- (same 8-step verification as above)
  |     +-- Records nullifier -> same identity can't vote twice on this proposal
  |
  +-- If choice == 1 -> proposals[id].yesVotes++
  |   Else           -> proposals[id].noVotes++
  |
  +-- Emit VoteCast(proposalId, choice, nullifierHash)
```

**Why per-proposal scoping matters:**

The nullifier is `Poseidon(privateKey, scope)`. Since scope is different for each proposal:
- Same identity -> different nullifier per proposal -> **votes are unlinkable**
- Same identity + same proposal -> same nullifier -> **can only vote once**
- Observer sees nullifier hashes in events but can't determine:
  - Which wallet voted
  - Whether the same person voted on two different proposals
  - What the voter's KYC level or identity is

**What this demonstrates for HashKey dApps:**

- **DAOs** — One-person-one-vote governance where whales can't dominate. Each verified identity gets exactly one vote, regardless of how many wallets they control (because the nullifier is tied to the identity, not the wallet).
- **Fair airdrops** — Each identity can claim once. Sybil-resistant without KYC disclosure.
- **Rate limiting** — One action per identity per scope. Faucets, free trials, referral programs.
- **Anonymous feedback** — Verified community members can submit feedback without fear of retaliation.

---

## Step 7: Revoke a Credential

**What happens:**
1. On the Revoke page, the user (or an issuer/admin) sees a list of registered credential hashes (fetched from the indexer)
2. They click "Revoke" on a credential
3. Frontend calls `RevocationRegistry.revoke(credentialHash)`
4. The credential hash is marked as revoked on-chain

**Three revocation levels:**

| Level | Function | Effect | Use case |
|-------|----------|--------|----------|
| **Credential** | `revoke(credentialHash)` | One specific credential is banned | User's KYC expired, single credential compromised |
| **Root** | `revokeRoot(merkleRoot)` | All proofs generated against this tree state are banned | Mass compromise, need to invalidate an entire batch |
| **Nullifier** | `revokeNullifier(nullifierHash)` | A specific usage is banned | Ban a specific vote or vault deposit retroactively |

**How revocation is enforced:**

When any dApp calls `verifyAndRecord`, the verifier checks (`ZKFabricVerifier.sol:79-89`):
```solidity
require(!revocation.isRootRevoked(merkleRoot), "root revoked");
require(!revocation.isNullifierRevoked(nullifierHash), "nullifier revoked");
```

If either check fails, the proof is rejected. This happens automatically for every dApp — they don't need to implement revocation logic themselves.

**What this demonstrates for HashKey dApps:**

- **Regulatory compliance** — If a user's KYC is revoked by HashKey, the issuer revokes the credential root. All existing proofs generated against that root stop working across every dApp simultaneously.
- **Incident response** — If a credential is compromised, revoke it immediately. All future proof attempts fail.
- **Granular control** — Revoke one credential without affecting others. Revoke one usage without invalidating the credential itself.

---

## Step 8: Attempt Proof After Revocation (Verification Fails)

**What happens:**
1. User tries to generate a new proof for the revoked credential
2. The proof generation itself succeeds (it's client-side math — the circuit doesn't know about revocation)
3. But when the dApp calls `verifyAndRecord`, the verifier checks the Merkle root against the revocation registry
4. If the root was revoked -> transaction reverts with "root revoked"
5. The user is blocked from using that credential across all dApps

This completes the lifecycle: **issue -> prove -> use -> revoke -> blocked**.

---

## How Any HashKey dApp Integrates

The integration is deliberately minimal. A dApp needs:

**Solidity (30 lines):**
```solidity
import { IZKFabric } from "@zkfabric/contracts";

contract MyDApp {
    IZKFabric zkFabric = IZKFabric(0x097f440A...);  // deployed verifier
    uint256 SCOPE = uint256(keccak256("my-dapp-v1")) % BN128_PRIME;

    function gatedAction(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external {
        zkFabric.verifyAndRecord(proof, publicSignals, SCOPE);
        // If we reach here, the user has valid KYC + predicates pass
        // + hasn't used this proof before + credential isn't revoked.
        // Do the actual action:
        doSomething(msg.sender);
    }
}
```

**That one line — `zkFabric.verifyAndRecord(proof, publicSignals, SCOPE)` — gives the dApp:**
1. Cryptographic proof verification (Groth16 pairing)
2. Merkle root validation (credential is registered)
3. Nullifier deduplication (no double-use)
4. Revocation enforcement (banned credentials rejected)
5. Predicate validation (user meets requirements)

**What the dApp does NOT need to build:**
- Its own KYC system
- Identity storage
- Compliance infrastructure
- Privacy engineering

The dApp gets compliance (every user is KYC-verified) and privacy (it never learns who the user is) from one function call. That's the value proposition for HashKey Chain: **shared identity infrastructure where every dApp benefits from HashKey's KYC system without any dApp becoming a privacy liability**.
