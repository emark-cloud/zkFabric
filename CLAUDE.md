# zkFabric — Development Guide

## Project Overview
zkFabric is a zero-knowledge selective-disclosure identity system for HashKey Chain, built for the HashKey Chain On-Chain Horizon Hackathon 2026 (ZKID Track, $10K prize pool).

## Chain: HashKey Chain Testnet
- **Chain ID**: 133
- **RPC URLs**: `https://testnet.hsk.xyz` (primary), `https://hk-testnet.rpc.alt.technology` (alt), `https://hashkey-testnet.drpc.org` (drpc)
- **WebSocket**: `wss://hashkey-testnet.drpc.org`
- **Explorer**: `https://testnet-explorer.hsk.xyz` (Blockscout)
- **Faucet**: Bridge Sepolia ETH via HashKey Bridge (no direct faucet confirmed). Original `https://faucet.hsk.xyz/faucet` URL unverified.
- **KYC Testnet Portal**: `https://kyc-testnet.hunyuankyc.com`
- **Type**: EVM-compatible L2 (OP Stack based, op-geth v1.101605.0)
- **Native Token**: HSK (18 decimals)
- **BN128 Precompiles**: Supported (inherited from OP Stack/Ethereum — ecAdd, ecMul, ecPairing work, Groth16 on-chain verification is safe)

## HashKey KYC SBT Interface
```solidity
interface IKycSBT {
    enum KycLevel { NONE, BASIC, ADVANCED, PREMIUM, ULTIMATE } // 0-4
    enum KycStatus { NONE, APPROVED, REVOKED } // 0-2

    function getKycInfo(address account) external view returns (
        string memory ensName,
        uint8 level,
        uint8 status,
        uint256 createTime
    );
    function isHuman(address account) external view returns (bool isValid, uint8 level);
    function requestKyc(string calldata ensName) external payable;
    function revokeKyc(address user) external;
    function restoreKyc(address user) external;
}
```
- **Contract address**: TBD — docs reference `KYC_SBT_ADDRESS` but never publish the actual address. Deploy `MockKycSBT.sol` for development; search testnet explorer or ask in HashKey Discord for real address.
- **Events**: KycRequested, KycLevelUpdated, KycStatusUpdated, KycRevoked, KycRestored, AddressApproved, EnsNameApproved

## Tech Stack
- **ZK Circuits**: Circom 2.1.9, snarkjs, circomlib (Poseidon, Comparators, MerkleProof)
- **Proof System**: Groth16 (client-side proving via WASM, ~200K gas on-chain verification)
- **Smart Contracts**: Solidity 0.8.28, Hardhat, OpenZeppelin
- **Merkle Tree**: Standard binary IMT (depth 20, arity 2) via `@zk-kit/imt` with Poseidon hash
- **Frontend**: Next.js 16, viem v2, wagmi, RainbowKit (7 pages: landing, issue, prove, vault, governance, revoke)
- **SDK**: TypeScript, snarkjs, poseidon-lite, @zk-kit/imt, @scure/bip39 (BIP39 recovery)
- **Indexer**: Hono + viem WebSocket event watcher, persists to JSON, exposes /leaves /root /health
- **Attestor**: Hono + @reclaimprotocol/js-sdk, EIP-191 signing for ZKTLSAdapter

## Key Architecture Decisions

### Identity System (Poseidon-based, NOT Semaphore V4 EdDSA)
- Identity = random private key (field element)
- Commitment = Poseidon(privateKey)
- Simpler than Semaphore V4's EdDSA approach; better suited for custom credential circuits

### Credential Commitment
- credentialHash = Poseidon(identityCommitment, slot[0], ..., slot[7])
- 8-slot fixed schema (see README for slot definitions)

### Merkle Tree (Standard Binary IMT, NOT LeanIMT)
- Using `@zk-kit/imt` (standard Incremental Merkle Tree) for off-chain tree
- Fixed depth 20, Poseidon hash, arity 2
- Avoids LeanIMT/circom impedance mismatch (no official LeanIMT circom template)
- Circuit uses standard `pathElements[20]` + `pathIndices[20]` format

### Nullifier
- nullifierHash = Poseidon(privateKey, scope)
- Unique per user per scope (dApp identifier)
- Prevents double-use within the same scope

## Circuit Constraints Budget (ACTUAL: 9,993 constraints, fits in ptau 2^14)
- Poseidon(1) for identity: ~240
- Poseidon(9) for credential: ~417
- Merkle proof (20 levels): ~4,860
- Poseidon(2) for nullifier: ~240
- 8 predicate evaluators (5 types each): ~4,256
- Total measured: **9,993 non-linear constraints**

## Trusted Setup (Hackathon)
- Phase 1: Hermez Powers of Tau (`powersOfTau28_hez_final_14.ptau`, 2^14 = 16K constraints)
- Phase 2: Single-contributor dev ceremony (acceptable for hackathon)
- Auto-generate `Groth16Verifier.sol` via `snarkjs zkey export solidityverifier`

## Key Commands
```bash
# Compile circuit
circom circuits/credential/selective_disclosure.circom --r1cs --wasm --sym -o circuits/build/ -l node_modules/circomlib/circuits

# Trusted setup
bash scripts/setup-ceremony.sh

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network hashkeyTestnet

# Run frontend
cd app && npm run dev

# Redeploy verifier + consumers (after contract changes)
GROTH16=0x... REGISTRY=0x... REVOCATION=0x... MOCK_ERC20=0x... \
  npx hardhat run scripts/redeploy-verifier.ts --network hashkeyTestnet

# Smoke-test revocation on live testnet
NODE_OPTIONS="--require ./scripts/force-ipv4.cjs" \
  npx hardhat run scripts/smoke-revocation.ts --network hashkeyTestnet

# Run indexer
cd indexer && npm run dev

# Run attestor
cd attestor && npm run dev
```

## WSL2 Network Workaround
HashKey Chain's Cloudflare-fronted RPC (`testnet.hsk.xyz`) has IPv6/IPv4 routing issues from WSL2. Use `NODE_OPTIONS="--require ./scripts/force-ipv4.cjs"` before any `npx hardhat run ... --network hashkeyTestnet` command. This patches undici and net to force IPv4.

## External Resources
- **HashKey Chain Docs**: https://docs.hashkeychain.net
- **HashKey KYC Docs**: https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC
- **HashKey GitHub**: https://github.com/HashkeyHSK
- **HashFans Developer Hub**: https://hashfans.io
- **Circom Docs**: https://docs.circom.io
- **snarkjs**: https://github.com/iden3/snarkjs
- **circomlib**: https://github.com/iden3/circomlib
- **Semaphore V4**: https://docs.semaphore.pse.dev
- **@zk-kit/imt**: https://github.com/privacy-scaling-explorations/zk-kit
- **Reclaim Protocol**: https://reclaimprotocol.org
- **Hackathon Page**: https://dorahacks.io/hackathon/2045/detail

## Hackathon Timeline (CRITICAL)
- **Total Prize Pool**: 40,000 USDT across 4 tracks (DeFi, PayFi, AI, ZKID)
- **Registration Deadline**: 2026-04-15
- **Demo Submission Opens**: 2026-04-14
- **Project Pre-screening**: 2026-04-14
- **Official Pitch**: 2026-04-16
- **Demo Showcase**: 2026-04-22 (AWS Office)
- **Final Pitch & Awards**: 2026-04-23 (Web3 Festival)
- **Submission Requirements**: GitHub repo with deployed HashKey Chain contract address in README, short demo video, clean git history from hackathon start (Mar 10)
- **Winners must complete KYC verification**

## Implementation Status (as of 2026-04-09)
- **Phase 0**: COMPLETE — project scaffolding, toolchain, hello-world circuit
- **Phase 1**: COMPLETE — all sub-circuits + main selective_disclosure circuit (9,993 constraints, 12/12 tests passing), Groth16Verifier.sol auto-generated
- **Phase 2**: COMPLETE — all smart contracts (Registry, Verifier, RevocationRegistry, KYCSBTAdapter, ZKTLSAdapter, GatedVault, PrivateGovernance, MockKycSBT, MockERC20), 28 contract tests passing
- **Phase 3**: COMPLETE — TypeScript SDK (identity, tree, prover, wallet, client, adapters), compiles with zero type errors
- **Phase 4**: COMPLETE — Next.js 16 frontend (landing, issue, prove, vault, governance, revoke pages), RainbowKit + wagmi for HashKey Chain
- **Phase 5**: COMPLETE — e2e integration tests (2 passing), all 65 tests green, deployed to HashKey Chain Testnet, BN128 field overflow + Groth16 pi_b ordering bugs fixed
- **Production Hardening (W1–W7)**: COMPLETE — on-chain revocation enforcement (smoke-tested live), event-indexed tree + BIP39 recovery, Reclaim attestor backend, threshold multisig contract, PrivateGovernance UI, NPM SDK metadata + INTEGRATION.md, revocation dashboard + atomic KYC ingest

## Research Findings (2026-04-05)
- **BN128 precompiles**: Confirmed working on OP Stack L2s. Groth16 on-chain verification is safe on HashKey Chain.
- **KYC SBT address**: NOT published in any docs. `MockKycSBT.sol` required for development.
- **Semaphore V4**: Uses EdDSA + Baby Jubjub + LeanIMT. Our custom Poseidon identity + standard IMT is the right divergence for credential circuits.
- **@zk-kit/imt**: Only beta versions exist (2.0.0-beta.8). API stable: `new IMT(poseidon2, depth, zeroValue, arity)`.
- **Circom**: 2.2.x exists but 2.1.9 is fine for hackathon. All circomlib templates stable.
- **snarkjs**: Versions beyond 0.7.6 exist but current version works. No upgrade needed.
- **Reclaim Protocol**: Uses signature-based attestation (not Groth16). NOT deployed on HashKey Chain testnet. Solved via `attestor/` backend that verifies Reclaim proofs server-side and signs for `ZKTLSAdapter.submitAttestation`.
- **Faucet**: No direct faucet URL confirmed. Docs say bridge Sepolia ETH via HashKey Bridge.

## Deployed Contract Addresses (HashKey Chain Testnet, Chain 133)
- Groth16Verifier: `0x3a442161cb51555bab8f59351e5e1704e8200506`
- ZKFabricRegistry: `0xa1708C934175Bf7EaC25220D560BE0C681725957`
- RevocationRegistry: `0x735680A32A0e5d9d23D7e8e8302F434e7F30428E`
- ZKFabricVerifier: `0xd49cA44645E21076dcd83F285D23c99AbeB6D299`
- MockKycSBT: `0x335C915Fa62eeBF9804a4398bb85Cd370B333850`
- KYCSBTAdapter: `0x3AfBFC76f49A4D466D03775B371a4F6142c6A194`
- ZKTLSAdapter: `0x310581957E11589F641199C3F7571A8eddEF38c8`
- MockERC20: `0x6670bB42279832548E976Fc9f2ddEbA6A03539F8`
- GatedVault: `0x6C1F9466db7Bc2364b0baC051E73421d5b75354B`
- PrivateGovernance: `0x2D036e311A6f11f8ABd191276Fd381Df55fbE224`
- Registry Owner: `0xECf5e30F091D1db7c7b0ef26634a71d46DC9Bb25`
