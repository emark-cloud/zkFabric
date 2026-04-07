import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HSK");

  // 1. Deploy Groth16Verifier (auto-generated)
  console.log("\n[1/7] Deploying Groth16Verifier...");
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
  const groth16Addr = await groth16Verifier.getAddress();
  console.log("  Groth16Verifier:", groth16Addr);

  // 2. Deploy ZKFabricRegistry
  console.log("[2/7] Deploying ZKFabricRegistry...");
  const ZKFabricRegistry = await ethers.getContractFactory("ZKFabricRegistry");
  const registry = await ZKFabricRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("  ZKFabricRegistry:", registryAddr);

  // 3. Deploy RevocationRegistry
  console.log("[3/7] Deploying RevocationRegistry...");
  const RevocationRegistry = await ethers.getContractFactory("RevocationRegistry");
  const revocation = await RevocationRegistry.deploy();
  await revocation.waitForDeployment();
  const revocationAddr = await revocation.getAddress();
  console.log("  RevocationRegistry:", revocationAddr);

  // 4. Deploy ZKFabricVerifier (wraps Groth16Verifier)
  console.log("[4/7] Deploying ZKFabricVerifier...");
  const ZKFabricVerifier = await ethers.getContractFactory("ZKFabricVerifier");
  const verifier = await ZKFabricVerifier.deploy(groth16Addr);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("  ZKFabricVerifier:", verifierAddr);

  // Link verifier to registry
  await verifier.setRegistry(registryAddr);
  console.log("  Linked verifier → registry");

  // Link verifier to revocation registry (enforces root + nullifier revocation)
  await verifier.setRevocationRegistry(revocationAddr);
  console.log("  Linked verifier → revocation registry");

  // 5. Deploy MockKycSBT + KYCSBTAdapter
  console.log("[5/7] Deploying MockKycSBT + KYCSBTAdapter...");
  const MockKycSBT = await ethers.getContractFactory("MockKycSBT");
  const mockKyc = await MockKycSBT.deploy();
  await mockKyc.waitForDeployment();
  const mockKycAddr = await mockKyc.getAddress();

  const KYCSBTAdapter = await ethers.getContractFactory("KYCSBTAdapter");
  const kycAdapter = await KYCSBTAdapter.deploy(mockKycAddr, registryAddr);
  await kycAdapter.waitForDeployment();
  const kycAdapterAddr = await kycAdapter.getAddress();

  // Authorize the adapter in the registry
  await registry.authorizeAdapter(kycAdapterAddr);
  console.log("  MockKycSBT:", mockKycAddr);
  console.log("  KYCSBTAdapter:", kycAdapterAddr, "(authorized)");

  // 6. Deploy ZKTLSAdapter
  console.log("[6/7] Deploying ZKTLSAdapter...");
  const ZKTLSAdapter = await ethers.getContractFactory("ZKTLSAdapter");
  const zktlsAdapter = await ZKTLSAdapter.deploy(registryAddr, deployer.address);
  await zktlsAdapter.waitForDeployment();
  const zktlsAddr = await zktlsAdapter.getAddress();

  await registry.authorizeAdapter(zktlsAddr);
  console.log("  ZKTLSAdapter:", zktlsAddr, "(authorized)");

  // 7. Deploy demo consumers
  console.log("[7/7] Deploying demo consumers...");

  // For GatedVault, we need a mock ERC20 asset
  const MockToken = await ethers.getContractFactory("MockERC20");
  let mockTokenAddr: string;
  try {
    const mockToken = await MockToken.deploy("Mock USDC", "mUSDC");
    await mockToken.waitForDeployment();
    mockTokenAddr = await mockToken.getAddress();
  } catch {
    // MockERC20 might not exist yet — skip vault deployment
    console.log("  Skipping GatedVault (no MockERC20 contract)");
    mockTokenAddr = "";
  }

  let vaultAddr = "";
  if (mockTokenAddr) {
    const GatedVault = await ethers.getContractFactory("GatedVault");
    const vault = await GatedVault.deploy(mockTokenAddr, verifierAddr, "zkFabric Vault", "zfVault");
    await vault.waitForDeployment();
    vaultAddr = await vault.getAddress();
    console.log("  MockERC20:", mockTokenAddr);
    console.log("  GatedVault:", vaultAddr);
  }

  const PrivateGovernance = await ethers.getContractFactory("PrivateGovernance");
  const governance = await PrivateGovernance.deploy(verifierAddr);
  await governance.waitForDeployment();
  const governanceAddr = await governance.getAddress();
  console.log("  PrivateGovernance:", governanceAddr);

  // Summary
  console.log("\n=== Deployment Complete ===");
  console.log(`Groth16Verifier:    ${groth16Addr}`);
  console.log(`ZKFabricRegistry:   ${registryAddr}`);
  console.log(`RevocationRegistry: ${revocationAddr}`);
  console.log(`ZKFabricVerifier:   ${verifierAddr}`);
  console.log(`MockKycSBT:         ${mockKycAddr}`);
  console.log(`KYCSBTAdapter:      ${kycAdapterAddr}`);
  console.log(`ZKTLSAdapter:       ${zktlsAddr}`);
  if (mockTokenAddr) console.log(`MockERC20:          ${mockTokenAddr}`);
  if (vaultAddr) console.log(`GatedVault:         ${vaultAddr}`);
  console.log(`PrivateGovernance:  ${governanceAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
