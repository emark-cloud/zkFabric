# @zkfabric/attestor

Backend signer that turns **Reclaim Protocol** zkTLS proofs into signed
attestations that `ZKTLSAdapter.submitAttestation` accepts on-chain.

## Flow

```
Reclaim mobile SDK  ──►  frontend  ──►  POST /attest  ──►  verify + sign  ──►  adapter.submitAttestation(user, commitment, data, sig)
```

1. User generates a Reclaim proof (e.g. GitHub account age) via the Reclaim SDK.
2. Frontend posts `{ user, identityCommitment, provider, primaryAttribute, reclaimProof }` to `/attest`.
3. Service calls `@reclaimprotocol/js-sdk` `verifyProof()` server-side.
4. Service packs the claim into 8 credential slots, ABI-encodes them, signs
   `keccak256(abi.encodePacked(user, identityCommitment, attestationData))`
   with `ATTESTOR_PRIVATE_KEY` using the EIP-191 prefix.
5. Frontend calls `ZKTLSAdapter.submitAttestation(user, identityCommitment, attestationData, signature)`;
   the contract recovers the signer and checks it matches the on-chain
   `attestor` address set via `ZKTLSAdapter.setAttestor`.

## Run

```bash
cd attestor
npm install
ATTESTOR_PRIVATE_KEY=0x... \
RECLAIM_APP_ID=... \
RECLAIM_APP_SECRET=... \
PORT=8788 \
npm run dev
```

For local demos you can bypass Reclaim verification:

```bash
ATTESTOR_DEV_MODE=1 ATTESTOR_PRIVATE_KEY=0x... npm run dev
```

Dev mode logs a loud warning on every request and **must not be used in production**.

## Wiring the adapter

After deploying `ZKTLSAdapter` with a placeholder attestor, point it at the
running service's signing address:

```bash
npx hardhat run scripts/set-attestor.ts --network hashkeyTestnet
# or from a console:
# await zktlsAdapter.setAttestor("0x<printed address from attestor boot log>")
```

## Endpoints

| Method | Path       | Body                                                                                                   |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/health`  | —                                                                                                      |
| POST   | `/attest`  | `{ user, identityCommitment, provider, primaryAttribute, jurisdictionCode?, auxiliaryData1?, auxiliaryData2?, reclaimProof? }` |

Response:

```json
{
  "attestor": "0x...",
  "slots": ["2","3","1","1712500000","0","...","2019","0"],
  "attestationData": "0x...",
  "messageHash": "0x...",
  "signature": "0x..."
}
```

## Environment

| Var                     | Default | Notes                                     |
| ----------------------- | ------- | ----------------------------------------- |
| `ATTESTOR_PRIVATE_KEY`  | —       | required, 0x-prefixed hex                 |
| `ATTESTOR_DEV_MODE`     | `0`     | set to `1` to skip Reclaim verification   |
| `RECLAIM_APP_ID`        | —       | required unless dev mode                  |
| `RECLAIM_APP_SECRET`    | —       | required unless dev mode                  |
| `PORT`                  | `8788`  |                                           |
