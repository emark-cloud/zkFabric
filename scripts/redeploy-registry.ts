/**
 * Redeploy ZKFabricRegistry with open updateRoot, then cascade:
 * - Redeploy ZKFabricVerifier (points to new registry)
 * - Redeploy GatedVault + PrivateGovernance (point to new verifier)
 * - Re-authorize both adapters on the new registry
 *
 * Reuses: Groth16Verifier, RevocationRegistry, MockKycSBT, KYCSBTAdapter,
 *         ZKTLSAdapter, MockERC20
 *
 * Usage:
 *   NODE_OPTIONS="--require ./scripts/force-ipv4.cjs" \
 *   npx hardhat run scripts/redeploy-registry.ts --network hashkeyTestnet
 */
import { ethers } from "hardhat";

const EXISTING = {
  groth16:    "0x3a442161cb51555bab8f59351e5e1704e8200506",
  revocation: "0x735680A32A0e5d9d23D7e8e8302F434e7F30428E",
  kycAdapter: "0x3AfBFC76f49A4D466D03775B371a4F6142c6A194",
  zktlsAdapter: "0x310581957E11589F641199C3F7571A8eddEF38c8",
  mockERC20:  "0x6670bB42279832548E976Fc9f2ddEbA6A03539F8",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("signer:", signer.address);

  // 1. Deploy new ZKFabricRegistry
  console.log("\n1. Deploying ZKFabricRegistry (open updateRoot)...");
  const Registry = await ethers.getContractFactory("ZKFabricRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("   ZKFabricRegistry:", registryAddr);

  // 2. Authorize both adapters on the new registry
  console.log("\n2. Authorizing adapters...");
  await (await registry.authorizeAdapter(EXISTING.kycAdapter)).wait();
  console.log("   KYCSBTAdapter authorized");
  await (await registry.authorizeAdapter(EXISTING.zktlsAdapter)).wait();
  console.log("   ZKTLSAdapter authorized");

  // 3. Deploy new ZKFabricVerifier and wire registry + revocation
  console.log("\n3. Deploying ZKFabricVerifier...");
  const Verifier = await ethers.getContractFactory("ZKFabricVerifier");
  const verifier = await Verifier.deploy(EXISTING.groth16);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("   ZKFabricVerifier:", verifierAddr);
  await (await verifier.setRegistry(registryAddr)).wait();
  console.log("   setRegistry → new registry");
  await (await verifier.setRevocationRegistry(EXISTING.revocation)).wait();
  console.log("   setRevocationRegistry → existing revocation");

  // 4. Deploy new GatedVault (ERC-4626: asset, zkFabric, name, symbol)
  console.log("\n4. Deploying GatedVault...");
  const Vault = await ethers.getContractFactory("GatedVault");
  const vault = await Vault.deploy(EXISTING.mockERC20, verifierAddr, "zkFabric Gated Vault", "gvMUSDC");
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("   GatedVault:", vaultAddr);

  // 5. Deploy new PrivateGovernance
  console.log("\n5. Deploying PrivateGovernance...");
  const Gov = await ethers.getContractFactory("PrivateGovernance");
  const gov = await Gov.deploy(verifierAddr);
  await gov.waitForDeployment();
  const govAddr = await gov.getAddress();
  console.log("   PrivateGovernance:", govAddr);

  // Summary
  console.log("\n════════════════════════════════════════════════");
  console.log("UPDATE THESE ADDRESSES in contracts.ts / README / etc:");
  console.log("════════════════════════════════════════════════");
  console.log(`  registry:   "${registryAddr}"`);
  console.log(`  verifier:   "${verifierAddr}"`);
  console.log(`  gatedVault: "${vaultAddr}"`);
  console.log(`  governance: "${govAddr}"`);
  console.log("════════════════════════════════════════════════");
  console.log("\nUNCHANGED:");
  console.log(`  groth16:      ${EXISTING.groth16}`);
  console.log(`  revocation:   ${EXISTING.revocation}`);
  console.log(`  kycAdapter:   ${EXISTING.kycAdapter}`);
  console.log(`  zktlsAdapter: ${EXISTING.zktlsAdapter}`);
  console.log(`  mockERC20:    ${EXISTING.mockERC20}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
