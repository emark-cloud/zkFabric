import { ethers } from "hardhat";
async function main() {
  const [s] = await ethers.getSigners();
  console.log("signer:", s.address);
  console.log("balance:", ethers.formatEther(await ethers.provider.getBalance(s.address)), "HSK");
}
main().catch((e) => { console.error(e); process.exit(1); });
