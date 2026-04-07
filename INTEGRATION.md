# Integrating zkFabric into your dApp

This guide walks you through adding zkFabric-gated access to a dApp on
HashKey Chain. End result: users present a ZK proof of some private
credential attribute (e.g. "KYC level ≥ 3"), your contract verifies it
on-chain, and you never see the underlying data.

You need:

1. A Solidity consumer contract that calls `ZKFabricVerifier.verifyAndRecord`.
2. A frontend that uses `@zkfabric/sdk` to generate Groth16 proofs.
3. A per-dApp **scope** constant — a BN128 field element unique to your dApp.

The whole integration is ~60 lines of Solidity + ~40 lines of TypeScript.

---

## 1. Pick a scope

A scope is a unique field element that makes nullifiers unlinkable across
dApps. Pick a string, keccak-hash it, and reduce modulo the BN128 prime:

```solidity
uint256 constant BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
uint256 public constant SCOPE =
    uint256(keccak256(abi.encodePacked("my-dapp-v1"))) % BN128_FIELD_PRIME;
```

Same formula on the client:

```ts
import { keccak256, encodePacked } from "viem";

const BN128 = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const scope =
  BigInt(keccak256(encodePacked(["string"], ["my-dapp-v1"]))) % BN128;
```

Users who prove on your dApp get a unique `nullifierHash` per identity, so
one user = one action, but they can freely prove on a different dApp without
being linked.

---

## 2. Write the consumer contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IZKFabric {
    function verifyAndRecord(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals,
        uint256 scope
    ) external returns (bool);
}

contract MyGatedApp {
    IZKFabric public immutable zkFabric;

    uint256 constant BN128_FIELD_PRIME =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant SCOPE =
        uint256(keccak256(abi.encodePacked("my-dapp-v1"))) % BN128_FIELD_PRIME;

    // HashKey Chain Testnet deployment of ZKFabricVerifier.
    address constant ZK_FABRIC = 0x65EF8Ad82EBfD0670a6086222Fe6CafCeE7b556D;

    event GatedActionPerformed(uint256 indexed nullifier);

    constructor() {
        zkFabric = IZKFabric(ZK_FABRIC);
    }

    function doGatedThing(
        uint256[8] calldata proof,
        uint256[] calldata publicSignals
    ) external {
        // zkFabric checks: valid Merkle root, all predicates pass,
        // nullifier not reused, credential root not revoked.
        zkFabric.verifyAndRecord(proof, publicSignals, SCOPE);

        // publicSignals[2] is the nullifier hash — useful for your own indexing.
        emit GatedActionPerformed(publicSignals[2]);

        // ... perform the gated action ...
    }
}
```

That's it. Deploy, and you have a dApp gated on any credential zkFabric
supports.

---

## 3. Client-side proof generation

Install the SDK:

```bash
npm install @zkfabric/sdk
```

Generate a proof (browser or Node):

```ts
import {
  identityFromMnemonic,
  CredentialTree,
  generateProof,
  formatProofForChain,
  PredicateType,
} from "@zkfabric/sdk";
import { keccak256, encodePacked } from "viem";

const BN128 = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const scope =
  BigInt(keccak256(encodePacked(["string"], ["my-dapp-v1"]))) % BN128;

// 1. Recover identity from the user's 12-word mnemonic.
const identity = identityFromMnemonic(userMnemonic);

// 2. Load the credential the user already issued via zkFabric.
//    (credentialSlots come from localStorage, the indexer, or your own store.)
const credentialSlots: bigint[] = /* 8 bigints, see SDK docs */;

// 3. Hydrate the Merkle tree from the on-chain event log.
const tree = await CredentialTree.fromIndexer("https://indexer.zkfabric.xyz");
const leafIndex = /* index returned when the credential was issued */;
const merkleProof = tree.getMerkleProof(leafIndex);

// 4. Build the proof. This predicate proves "slot[1] >= 3" — typically
//    "KYC level is at least ADVANCED" — without revealing the exact level.
const { proof, publicSignals } = await generateProof(
  {
    identity,
    credentialSlots,
    merkleProof,
    scope,
    predicates: [
      { slotIndex: 1, type: PredicateType.GREATER_EQUAL, value: 3n },
    ],
  },
  {
    wasmPath: "/circuits/selective_disclosure.wasm",
    zkeyPath: "/circuits/selective_disclosure_final.zkey",
  }
);

// 5. Submit to your contract.
const formatted = formatProofForChain(proof);
await myGatedApp.write.doGatedThing([formatted, publicSignals]);
```

Host the two circuit artifacts (`.wasm` + `.zkey`) from your app's static
directory. Copies live in `app/public/circuits/` in the zkFabric repo and
are ~6 MB combined.

---

## 4. What gets verified on-chain

`ZKFabricVerifier.verifyAndRecord` performs four checks:

1. **Groth16 verification** — the proof is a valid Groth16 proof for the
   selective_disclosure circuit.
2. **Merkle root validity** — `publicSignals[1]` is a root registered with
   `ZKFabricRegistry` (rolling window of the 100 most recent roots).
3. **Revocation check** — neither the Merkle root nor the nullifier hash is
   revoked in `RevocationRegistry`.
4. **Nullifier uniqueness** — `publicSignals[2]` has not been used before.

All four must pass or the call reverts. Your consumer contract doesn't need
to check anything itself.

The public signals layout is:

| Index    | Meaning                                |
| -------- | -------------------------------------- |
| `[0]`    | `allPredicatesPass` (1 or 0)           |
| `[1]`    | Merkle root                            |
| `[2]`    | Nullifier hash (unique per user+scope) |
| `[3..50]`| Predicate type + value + slot index    |
| `[51]`   | Scope (echoes the input)               |

---

## 5. Scopes in practice

| dApp              | Scope string                     |
| ----------------- | -------------------------------- |
| GatedVault        | `"zkfabric-gated-vault-v1"`      |
| PrivateGovernance | `"zkfabric-governance-v1" || id` |

Bind per-action state (like proposal ID) into the scope if you want
"one vote per proposal per identity." If you want "one action per identity
ever", use a plain string scope.

---

## 6. Issuing credentials

Users issue credentials once, then reuse them across every zkFabric-integrated
dApp. The two paths shipped today:

- **KYC SBT** — user's HashKey KYC SBT (or `MockKycSBT` on testnet) is read
  by `KYCSBTAdapter.ingestCredential`, which emits a `CredentialRegistered`
  event.
- **zkTLS** — user generates a Reclaim Protocol proof in the Reclaim SDK,
  posts it to the `@zkfabric/attestor` backend, which verifies it server-side
  and signs the 8 slots for `ZKTLSAdapter.submitAttestation`.

Both paths end with the same on-chain event and the same tree, so your dApp
doesn't care which source a credential came from — only what predicates it
satisfies.

---

## 7. Minimal example

A full working example (Hardhat consumer contract + Next.js frontend snippet)
lives under `examples/integration-example/` in the repo.

```bash
git clone https://github.com/emark-cloud/zkFabric
cd zkFabric/examples/integration-example
cat README.md
```

---

## Questions

Open an issue at <https://github.com/emark-cloud/zkFabric/issues>.
