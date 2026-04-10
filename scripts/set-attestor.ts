import { ethers } from "hardhat";
async function main() {
  const addr = process.env.ATTESTOR_ADDR;
  if (!addr) throw new Error("Set ATTESTOR_ADDR env var");
  const adapter = await ethers.getContractAt("ZKTLSAdapter", "0x310581957E11589F641199C3F7571A8eddEF38c8");
  const tx = await adapter.setAttestor(addr);
  await tx.wait();
  console.log("attestor set to:", await adapter.attestor());
}
main().catch((e) => { console.error(e); process.exit(1); });
