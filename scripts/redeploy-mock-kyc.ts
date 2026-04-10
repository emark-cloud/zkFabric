import { ethers } from "hardhat";
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("signer:", signer.address);
  const F = await ethers.getContractFactory("MockKycSBT");
  const c = await F.deploy();
  await c.waitForDeployment();
  console.log("MockKycSBT:", await c.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
