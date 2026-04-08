# zkFabric integration example

A minimal Hardhat project showing how a third-party dApp plugs into zkFabric.
The consumer contract (`ExampleGatedApp.sol`) emits an event iff the caller
presents a valid ZK proof that their credential satisfies a chosen predicate.

Pair it with `scripts/call-example.ts`, which uses `@zkfabric/sdk` to generate
the proof client-side and submit it.

## Layout

```
contracts/
  ExampleGatedApp.sol    # ~40-line consumer
scripts/
  call-example.ts        # end-to-end: build proof → submit → read event
```

## Running against HashKey Chain Testnet

```bash
npm install
npm install @zkfabric/sdk

# Deploy the consumer
npx hardhat run scripts/deploy.ts --network hashkeyTestnet

# Generate a proof and call it
CONSUMER_ADDRESS=0x... \
USER_MNEMONIC="..." \
LEAF_INDEX=0 \
npx hardhat run scripts/call-example.ts --network hashkeyTestnet
```

The consumer calls the live `ZKFabricVerifier` at
`0xd49cA44645E21076dcd83F285D23c99AbeB6D299`, so you don't need to redeploy
any zkFabric infrastructure.

See `INTEGRATION.md` at the repo root for the full walkthrough.
