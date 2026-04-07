/**
 * Point the deployed ZKTLSAdapter at a new attestor signing address.
 *
 * Usage:
 *   ATTESTOR_ADDRESS=0x... \
 *   ZKTLS_ADAPTER=0x310581957E11589F641199C3F7571A8eddEF38c8 \
 *   npx hardhat run scripts/set-attestor.ts --network hashkeyTestnet
 */
import { ethers } from "hardhat";

async function main() {
  const attestor = process.env.ATTESTOR_ADDRESS;
  const adapterAddr =
    process.env.ZKTLS_ADAPTER ?? "0x310581957E11589F641199C3F7571A8eddEF38c8";
  if (!attestor || !ethers.isAddress(attestor)) {
    throw new Error("ATTESTOR_ADDRESS env var must be a valid 0x address");
  }

  const [signer] = await ethers.getSigners();
  console.log(`signer:   ${signer.address}`);
  console.log(`adapter:  ${adapterAddr}`);
  console.log(`attestor: ${attestor}`);

  const adapter = await ethers.getContractAt("ZKTLSAdapter", adapterAddr, signer);
  const current = await adapter.attestor();
  console.log(`current attestor: ${current}`);
  if (current.toLowerCase() === attestor.toLowerCase()) {
    console.log("attestor already set — nothing to do");
    return;
  }
  const tx = await adapter.setAttestor(attestor);
  console.log(`tx: ${tx.hash}`);
  await tx.wait();
  console.log("attestor updated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
