/**
 * Deploy a fresh RevocationRegistry (with W1 root/nullifier revocation),
 * then rewire the existing ZKFabricVerifier to point at it.
 *
 * Usage:
 *   VERIFIER=0xd49cA44645E21076dcd83F285D23c99AbeB6D299 \
 *   npx hardhat run scripts/redeploy-revocation.ts --network hashkeyTestnet
 */
import { ethers } from "hardhat";

async function main() {
  const verifierAddr = process.env.VERIFIER;
  if (!verifierAddr || !ethers.isAddress(verifierAddr)) {
    throw new Error("VERIFIER env var must be a 0x address");
  }

  const [signer] = await ethers.getSigners();
  console.log("signer:", signer.address);

  console.log("\n[1/2] Deploying RevocationRegistry...");
  const Rev = await ethers.getContractFactory("RevocationRegistry");
  const rev = await Rev.deploy();
  await rev.waitForDeployment();
  const revAddr = await rev.getAddress();
  console.log("  RevocationRegistry:", revAddr);

  console.log("\n[2/2] Wiring verifier.setRevocationRegistry...");
  const verifier = await ethers.getContractAt("ZKFabricVerifier", verifierAddr);
  const tx = await verifier.setRevocationRegistry(revAddr);
  await tx.wait();
  const wired = await verifier.revocationRegistry();
  if (wired.toLowerCase() !== revAddr.toLowerCase()) {
    throw new Error("setRevocationRegistry did not stick");
  }
  console.log("  verifier.revocationRegistry =", wired);

  console.log("\n=====================================================");
  console.log("New RevocationRegistry — update contracts.ts + docs:");
  console.log(`  revocation: "${revAddr}"`);
  console.log("=====================================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
