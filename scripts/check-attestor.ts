import { ethers } from "hardhat";
async function main() {
  const adapter = await ethers.getContractAt("ZKTLSAdapter", "0xFd631dfa331088CEc9e1ecdC8678A456b721EbD1");
  console.log("attestor:", await adapter.attestor());
  console.log("registry:", await adapter.registry());
}
main().catch((e) => { console.error(e); process.exit(1); });
