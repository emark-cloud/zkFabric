/**
 * Redeploy ZKFabricVerifier (W1 enforcement) and the two consumers whose
 * `zkFabric` reference is immutable.
 *
 * Why: the verifier currently deployed on HashKey Chain Testnet predates W1,
 * so its revocationRegistry is the zero address and the new root/nullifier
 * revocation check is a no-op on-chain. This script redeploys the verifier
 * with the existing Groth16Verifier, wires it to the existing Registry +
 * RevocationRegistry, then redeploys GatedVault and PrivateGovernance
 * pointing at the new verifier. The Registry, RevocationRegistry, adapters,
 * MockERC20, and MockKycSBT are REUSED as-is.
 *
 * After it prints the new addresses, paste them into:
 *   - app/src/lib/contracts.ts          (verifier, gatedVault, governance)
 *   - sdk/README.md                     (deployed contracts table)
 *   - README.md                         (deployed contracts table)
 *   - INTEGRATION.md                    (ZK_FABRIC constant in ExampleGatedApp)
 *   - PROJECT_STATUS.md                 (deployed contracts table)
 *
 * Usage:
 *   GROTH16=0x3a442161cb51555bab8f59351e5e1704e8200506 \
 *   REGISTRY=0xa1708C934175Bf7EaC25220D560BE0C681725957 \
 *   REVOCATION=0xfC9f91c305dfB69861bB1C7DD9777b4784FeCC8E \
 *   MOCK_ERC20=0x6670bB42279832548E976Fc9f2ddEbA6A03539F8 \
 *   npx hardhat run scripts/redeploy-verifier.ts --network hashkeyTestnet
 *
 * The signer running the script MUST be the current owner of the *new*
 * verifier (it will be, since this script deploys it fresh).
 */
import { ethers } from "hardhat";

function requireAddr(name: string, v: string | undefined): string {
  if (!v || !ethers.isAddress(v)) throw new Error(`${name} env var must be a valid 0x address`);
  return v;
}

async function main() {
  const groth16 = requireAddr("GROTH16", process.env.GROTH16);
  const registry = requireAddr("REGISTRY", process.env.REGISTRY);
  const revocation = requireAddr("REVOCATION", process.env.REVOCATION);
  const mockERC20 = requireAddr("MOCK_ERC20", process.env.MOCK_ERC20);

  const [deployer] = await ethers.getSigners();
  console.log(`deployer: ${deployer.address}`);
  console.log(`balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} HSK`);
  console.log("reusing:");
  console.log(`  Groth16Verifier:    ${groth16}`);
  console.log(`  ZKFabricRegistry:   ${registry}`);
  console.log(`  RevocationRegistry: ${revocation}`);
  console.log(`  MockERC20:          ${mockERC20}`);

  // 1. ZKFabricVerifier (with W1 revocation enforcement)
  console.log("\n[1/3] Deploying ZKFabricVerifier...");
  const Verifier = await ethers.getContractFactory("ZKFabricVerifier");
  const verifier = await Verifier.deploy(groth16);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log(`  ZKFabricVerifier: ${verifierAddr}`);

  console.log("  → setRegistry...");
  await (await verifier.setRegistry(registry)).wait();
  console.log("  → setRevocationRegistry...");
  await (await verifier.setRevocationRegistry(revocation)).wait();
  console.log("  verifier wired");

  // 2. GatedVault (immutable zkFabric reference → must redeploy)
  console.log("\n[2/3] Deploying GatedVault...");
  const GatedVault = await ethers.getContractFactory("GatedVault");
  const vault = await GatedVault.deploy(mockERC20, verifierAddr, "zkFabric Gated Vault", "zkGV");
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`  GatedVault: ${vaultAddr}`);

  // 3. PrivateGovernance (immutable zkFabric reference → must redeploy)
  console.log("\n[3/3] Deploying PrivateGovernance...");
  const Governance = await ethers.getContractFactory("PrivateGovernance");
  const gov = await Governance.deploy(verifierAddr);
  await gov.waitForDeployment();
  const govAddr = await gov.getAddress();
  console.log(`  PrivateGovernance: ${govAddr}`);

  console.log("\n=====================================================");
  console.log("New addresses — update contracts.ts and docs:");
  console.log("=====================================================");
  console.log(`  verifier:         "${verifierAddr}"`);
  console.log(`  gatedVault:       "${vaultAddr}"`);
  console.log(`  governance:       "${govAddr}"`);
  console.log("\nVerification — confirm wiring:");
  console.log(`  verifier.registry()           == ${registry}`);
  console.log(`  verifier.revocationRegistry() == ${revocation}`);
  console.log("  Revoke a root in the dashboard, try to deposit — it should now revert");
  console.log("  with 'ZKFabricVerifier: root revoked'.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
