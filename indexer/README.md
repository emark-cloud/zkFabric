# @zkfabric/indexer

Event-driven Merkle leaf indexer for zkFabric. Watches the
`CredentialRegistered` event on the deployed `ZKFabricRegistry`, persists the
leaf list in insertion order, and exposes it over HTTP so the frontend / SDK
can rebuild the credential Merkle tree on any device — eliminating the
localStorage single-point-of-failure that ships with the demo.

## Why this exists

Before the indexer, the off-chain Merkle tree lived only in browser
`localStorage`. Wiping the browser meant losing the ability to generate
inclusion proofs for previously-issued credentials. With the indexer, the
on-chain event log becomes the source of truth: the SDK calls
`CredentialTree.fromIndexer(url)` and replays state in seconds.

## Endpoints

| Method | Path       | Returns                                                          |
| ------ | ---------- | ---------------------------------------------------------------- |
| GET    | `/health`  | `{ ok, chainId, registry, lastBlock, count }`                    |
| GET    | `/leaves`  | `{ leaves: string[], lastBlock, count }` — insertion order       |
| GET    | `/root`    | `{ currentRoot }` — live `currentRoot()` read from the registry  |

## Run

```bash
cd indexer
npm install
REGISTRY_ADDRESS=0xa1708C934175Bf7EaC25220D560BE0C681725957 \
RPC_URL=https://testnet.hsk.xyz \
WS_URL=wss://hashkey-testnet.drpc.org \
DEPLOY_BLOCK=0 \
PORT=8787 \
npm run dev
```

State persists to `./data/state.json`.

## Environment

| Var                | Default                                          |
| ------------------ | ------------------------------------------------ |
| `REGISTRY_ADDRESS` | `0xa1708C934175Bf7EaC25220D560BE0C681725957`     |
| `RPC_URL`          | `https://testnet.hsk.xyz`                        |
| `WS_URL`           | `wss://hashkey-testnet.drpc.org`                 |
| `CHAIN_ID`         | `133`                                            |
| `DEPLOY_BLOCK`     | `0` (override with the registry's deploy block)  |
| `PORT`             | `8787`                                           |
| `STATE_FILE`       | `./data/state.json`                              |
| `BACKFILL_CHUNK`   | `5000`                                           |

## SDK integration

```ts
import { CredentialTree } from "@zkfabric/sdk";

const tree = await CredentialTree.fromIndexer("https://indexer.zkfabric.xyz");
const proof = tree.getMerkleProof(myLeafIndex);
```

The frontend uses the indexer as the source of truth and falls back to
localStorage as a cache for offline reads.
