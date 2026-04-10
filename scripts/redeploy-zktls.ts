import { ethers } from "hardhat";
async function main() {
  const registry = "0x93415BCDbAda30f06274c32fE7b713bF9AB460C1";
  const [signer] = await ethers.getSigners();
  // Use signer address as attestor for now — we'll start the attestor service with the same key
  console.log("Deploying ZKTLSAdapter with attestor =", signer.address);
  const F = await ethers.getContractFactory("ZKTLSAdapter");
  const c = await F.deploy(registry, signer.address);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("ZKTLSAdapter:", addr);

  // Authorize on new registry
  const reg = await ethers.getContractAt("ZKFabricRegistry", registry);
  await (await reg.authorizeAdapter(addr)).wait();
  console.log("Authorized on registry");
}
main().catch((e) => { console.error(e); process.exit(1); });
