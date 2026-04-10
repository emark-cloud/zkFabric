import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);

  const RevocationRegistry = await ethers.getContractFactory("RevocationRegistry");
  const revocation = await RevocationRegistry.deploy();
  await revocation.waitForDeployment();
  const addr = await revocation.getAddress();
  console.log("RevocationRegistry deployed to:", addr);

  // Wire the verifier to the new revocation registry
  const VERIFIER = "0x097f440AECDD999ad6F33229a6cc24Ef27E85267";
  const verifier = await ethers.getContractAt("ZKFabricVerifier", VERIFIER);
  const tx = await verifier.setRevocationRegistry(addr);
  await tx.wait();
  console.log("Verifier updated to use new RevocationRegistry");

  console.log("\nUpdate contracts.ts:");
  console.log(`  revocation: "${addr}" as \`0x\${string}\`,`);
}

main().catch((e) => { console.error(e); process.exit(1); });
