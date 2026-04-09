# @zkfabric/sdk

TypeScript SDK for **zkFabric** — a zero-knowledge selective-disclosure identity
system for HashKey Chain. Build dApps that gate access, voting, and payments on
private credentials (KYC SBT, zkTLS attestations, on-chain activity) without
leaking the underlying data.

```bash
npm install @zkfabric/sdk
```

## What you get

- **Identity** — BIP39-recoverable Poseidon identities (`createIdentity`, `identityFromMnemonic`)
- **Credentials** — 8-slot Poseidon commitments, fixed schema, KYC + zkTLS adapters included
- **Merkle tree** — `CredentialTree` backed by `@zk-kit/imt`, with `fromIndexer()` for event-sourced hydration
- **Proving** — `generateProof()` / `formatProofForChain()` for Groth16 in Node or browser
- **Client** — `ZKFabric` high-level class for dApps; `ZKFabricWallet` for user flows

## Quick start — prove a credential and verify on-chain

```ts
import {
  createIdentity,
  CredentialTree,
  packKycSlots,
  computeCredentialHash,
  generateProof,
  formatProofForChain,
  PredicateType,
} from "@zkfabric/sdk";

// 1. User identity (in production: identityFromMnemonic(userMnemonic))
const identity = createIdentity();

// 2. Pack a KYC credential into 8 slots + Poseidon-commit it
const slots = packKycSlots(
  { ensName: "alice.hsk", level: 3, status: 1, createTime: 1712000000n },
  344n, // jurisdictionCode (HK)
  1n,   // issuerIdentifier
);
const credentialHash = computeCredentialHash(identity.commitment, slots);

// 3. Rebuild the credential tree from the on-chain event log
const tree = await CredentialTree.fromIndexer("https://indexer.zkfabric.xyz");
const leafIndex = tree.leaves.findIndex((l) => l === credentialHash);
const merkleProof = tree.getMerkleProof(leafIndex);

// 4. Generate a Groth16 proof disclosing only "KYC level >= 3"
const { proof, publicSignals } = await generateProof(
  {
    identity,
    credentialSlots: slots,
    merkleProof,
    scope: myDappScope, // bigint, unique per dApp
    predicates: [
      { slotIndex: 1, type: PredicateType.GREATER_EQUAL, value: 3n },
    ],
  },
  {
    wasmPath: "/circuits/selective_disclosure.wasm",
    zkeyPath: "/circuits/selective_disclosure_final.zkey",
  },
);

// 5. Submit to your on-chain verifier
const formatted = formatProofForChain(proof);
await myContract.verifyAndRecord(formatted, publicSignals, myDappScope);
```

## Architecture at a glance

```
┌──────────────┐   issue    ┌──────────────┐   replay   ┌──────────────┐
│ KYC SBT /    │ ─────────► │ ZKFabric     │ ◄───────── │ indexer      │
│ zkTLS /      │            │ Registry     │  events    │ (off-chain)  │
│ attestor     │            └──────────────┘            └──────────────┘
└──────────────┘                   │                           │
                                   │                           │
                          ┌────────▼────────┐          ┌───────▼────────┐
                          │ credential hash │          │ CredentialTree │
                          │ + nullifier     │          │ (@zk-kit/imt)  │
                          └────────┬────────┘          └───────┬────────┘
                                   │                           │
                                   │          prove            │
                                   └──────────┬────────────────┘
                                              ▼
                                   ┌────────────────────────┐
                                   │ Groth16 selective      │
                                   │ disclosure circuit     │
                                   │ (9,993 constraints)    │
                                   └──────────┬─────────────┘
                                              ▼
                                   ┌────────────────────────┐
                                   │ ZKFabricVerifier       │
                                   │ + nullifier + revoke   │
                                   └────────────────────────┘
```

## API surface

### Identity

```ts
import {
  createIdentity,
  identityFromMnemonic,
  generateMnemonic12,
  computeIdentityCommitment,
  computeCredentialHash,
  computeNullifier,
} from "@zkfabric/sdk";
```

### Credentials

```ts
import {
  packKycSlots,      // KYC SBT → 8-slot credential
  packZktlsSlots,    // Reclaim-style attestation → 8-slot credential
  CredentialType,    // 1=KYC_SBT, 2=ZKTLS, 3=ON_CHAIN
} from "@zkfabric/sdk";
```

### Tree

```ts
import { CredentialTree } from "@zkfabric/sdk";

// From on-chain event log (via indexer):
const tree = await CredentialTree.fromIndexer("https://indexer.zkfabric.xyz");

// From local leaves:
const tree2 = CredentialTree.import({ leaves: ["123", "456"] });

const proof = tree.getMerkleProof(leafIndex);
```

### Proving

```ts
import {
  buildCircuitInput,
  generateProof,
  verifyProof,
  formatProofForChain,
  PredicateType, // NONE | EQUALS | GREATER_EQUAL | LESS_EQUAL | IN_SET
} from "@zkfabric/sdk";
```

### Predicates

| PredicateType   | Meaning                         |
| --------------- | ------------------------------- |
| `NONE` (0)      | slot is ignored                 |
| `EQUALS` (1)    | `slot == value`                 |
| `GREATER_EQUAL` (2) | `slot >= value`             |
| `LESS_EQUAL` (3) | `slot <= value`                |
| `IN_SET` (4)    | `slot ∈ {set[0..3]}`           |

Only the predicate type and threshold are revealed on-chain — the actual slot
value stays inside the proof.

## Deployed contracts (HashKey Chain Testnet)

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| Groth16Verifier     | `0x3a442161cb51555bab8f59351e5e1704e8200506` |
| ZKFabricRegistry    | `0xa1708C934175Bf7EaC25220D560BE0C681725957` |
| ZKFabricVerifier    | `0xd49cA44645E21076dcd83F285D23c99AbeB6D299` |
| RevocationRegistry  | `0x735680A32A0e5d9d23D7e8e8302F434e7F30428E` |
| KYCSBTAdapter       | `0x3AfBFC76f49A4D466D03775B371a4F6142c6A194` |
| ZKTLSAdapter        | `0x310581957E11589F641199C3F7571A8eddEF38c8` |
| GatedVault          | `0x6C1F9466db7Bc2364b0baC051E73421d5b75354B` |
| PrivateGovernance   | `0x2D036e311A6f11f8ABd191276Fd381Df55fbE224` |

Full deployment, circuit artifacts, and an integration walkthrough live in the
repo: <https://github.com/emark-cloud/zkFabric>.

See `INTEGRATION.md` at the repo root for a complete dApp integration guide.

## License

MIT
