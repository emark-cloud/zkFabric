/**
 * Deploy ZKFabricMultisig and transfer ownership of the core contracts to it.
 *
 * Usage:
 *   MULTISIG_OWNERS=0xaaa,0xbbb,0xccc \
 *   MULTISIG_THRESHOLD=2 \
 *   REGISTRY=0xa1708C934175Bf7EaC25220D560BE0C681725957 \
 *   VERIFIER=0x65EF8Ad82EBfD0670a6086222Fe6CafCeE7b556D \
 *   REVOCATION=0xfC9f91c305dfB69861bB1C7DD9777b4784FeCC8E \
 *   npx hardhat run scripts/deploy-multisig.ts --network hashkeyTestnet
 *
 * The signer running the script MUST currently own Registry/Verifier/Revocation
 * (i.e. it must be the existing `owner()` — by default, the Registry owner is
 * 0xECf5e30F091D1db7c7b0ef26634a71d46DC9Bb25 on testnet).
 *
 * Post-deploy, all three contracts are owned by the multisig address. Any
 * future `updateRoot`, `setRevocationRegistry`, `revokeRoot`, etc. must be
 * routed through `multisig.submit() → confirm() → execute()`.
 */
import { ethers } from "hardhat";

async function main() {
  const ownersRaw = process.env.MULTISIG_OWNERS;
  const threshold = Number(process.env.MULTISIG_THRESHOLD ?? "2");
  const registryAddr = process.env.REGISTRY;
  const verifierAddr = process.env.VERIFIER;
  const revocationAddr = process.env.REVOCATION;

  if (!ownersRaw) throw new Error("MULTISIG_OWNERS (comma-separated) required");
  const owners = ownersRaw.split(",").map((s) => s.trim());
  for (const o of owners) {
    if (!ethers.isAddress(o)) throw new Error(`bad owner address: ${o}`);
  }
  if (threshold < 1 || threshold > owners.length) {
    throw new Error(`bad threshold ${threshold} for ${owners.length} owners`);
  }

  const [signer] = await ethers.getSigners();
  console.log(`deployer: ${signer.address}`);
  console.log(`owners:   ${owners.join(", ")}`);
  console.log(`threshold: ${threshold}-of-${owners.length}`);

  const Multisig = await ethers.getContractFactory("ZKFabricMultisig");
  const multisig = await Multisig.deploy(owners, threshold);
  await multisig.waitForDeployment();
  const msAddr = await multisig.getAddress();
  console.log(`\nZKFabricMultisig: ${msAddr}`);

  async function transfer(label: string, addr: string | undefined) {
    if (!addr) {
      console.log(`skip ${label}: no address provided`);
      return;
    }
    const c = await ethers.getContractAt(
      [
        "function owner() view returns (address)",
        "function transferOwnership(address) external",
      ],
      addr,
      signer
    );
    const current = (await c.owner()) as string;
    if (current.toLowerCase() === msAddr.toLowerCase()) {
      console.log(`${label}: already owned by multisig`);
      return;
    }
    if (current.toLowerCase() !== signer.address.toLowerCase()) {
      console.log(`${label}: WARNING current owner ${current} is not the deployer; skipping`);
      return;
    }
    const tx = await c.transferOwnership(msAddr);
    console.log(`${label}: transferOwnership tx ${tx.hash}`);
    await tx.wait();
    console.log(`${label}: ownership -> multisig`);
  }

  await transfer("ZKFabricRegistry", registryAddr);
  await transfer("ZKFabricVerifier", verifierAddr);
  await transfer("RevocationRegistry", revocationAddr);

  console.log("\ndone");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
