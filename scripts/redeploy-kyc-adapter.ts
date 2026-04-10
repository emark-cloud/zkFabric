import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);

  const NEW_KYC_SBT = "0x566e1F1B5bD7109F2C86805e2c092502D1B2f9f4";
  const NEW_REGISTRY = "0x93415BCDbAda30f06274c32fE7b713bF9AB460C1";

  const KYCAdapter = await ethers.getContractFactory("KYCSBTAdapter");
  const adapter = await KYCAdapter.deploy(NEW_KYC_SBT, NEW_REGISTRY);
  await adapter.waitForDeployment();
  const addr = await adapter.getAddress();
  console.log("KYCSBTAdapter deployed to:", addr);

  // Authorize on registry
  const registry = await ethers.getContractAt("ZKFabricRegistry", NEW_REGISTRY);
  const tx = await registry.authorizeAdapter(addr);
  await tx.wait();
  console.log("Adapter authorized on registry");

  console.log("\nUpdate contracts.ts:");
  console.log(`  kycAdapter: "${addr}" as \`0x\${string}\`,`);
}

main().catch((e) => { console.error(e); process.exit(1); });
