import { ethers } from "hardhat";

async function main() {
  const issuer = process.env.ISSUER_ADDR;
  if (!issuer) throw new Error("Set ISSUER_ADDR env var");

  const revocation = await ethers.getContractAt("RevocationRegistry", "0x735680A32A0e5d9d23D7e8e8302F434e7F30428E");
  const tx = await revocation.authorizeIssuer(issuer);
  await tx.wait();
  console.log("Authorized issuer:", issuer);
}

main().catch((e) => { console.error(e); process.exit(1); });
