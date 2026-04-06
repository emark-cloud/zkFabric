import { expect } from "chai";
import { ethers } from "hardhat";

describe("MockKycSBT + KYCSBTAdapter", function () {
  let mockKyc: any, registry: any, adapter: any;
  let owner: any, user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy registry
    const Registry = await ethers.getContractFactory("ZKFabricRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Deploy mock KYC SBT
    const MockKyc = await ethers.getContractFactory("MockKycSBT");
    mockKyc = await MockKyc.deploy();
    await mockKyc.waitForDeployment();

    // Deploy adapter
    const Adapter = await ethers.getContractFactory("KYCSBTAdapter");
    adapter = await Adapter.deploy(
      await mockKyc.getAddress(),
      await registry.getAddress()
    );
    await adapter.waitForDeployment();

    // Authorize adapter in registry
    await registry.authorizeAdapter(await adapter.getAddress());
  });

  describe("MockKycSBT", function () {
    it("should set and read KYC info", async function () {
      await mockKyc.setKycInfo(user.address, "alice.hsk", 3, 1); // PREMIUM, APPROVED
      const [ensName, level, status, createTime] = await mockKyc.getKycInfo(user.address);
      expect(ensName).to.equal("alice.hsk");
      expect(level).to.equal(3);
      expect(status).to.equal(1);
      expect(createTime).to.be.gt(0);
    });

    it("should auto-approve on requestKyc", async function () {
      await mockKyc.connect(user).requestKyc("bob.hsk");
      const [, level, status] = await mockKyc.getKycInfo(user.address);
      expect(level).to.equal(1); // BASIC
      expect(status).to.equal(1); // APPROVED
    });

    it("should revoke and restore", async function () {
      await mockKyc.setKycInfo(user.address, "alice.hsk", 3, 1);
      await mockKyc.revokeKyc(user.address);
      const [, , status1] = await mockKyc.getKycInfo(user.address);
      expect(status1).to.equal(2); // REVOKED

      await mockKyc.restoreKyc(user.address);
      const [, , status2] = await mockKyc.getKycInfo(user.address);
      expect(status2).to.equal(1); // APPROVED
    });

    it("should check isHuman", async function () {
      await mockKyc.setKycInfo(user.address, "alice.hsk", 3, 1);
      const [isValid, level] = await mockKyc.isHuman(user.address);
      expect(isValid).to.be.true;
      expect(level).to.equal(3);
    });
  });

  describe("KYCSBTAdapter", function () {
    it("should ingest credential for approved user", async function () {
      await mockKyc.setKycInfo(user.address, "alice.hsk", 3, 1);
      const identityCommitment = 12345;

      await expect(adapter.ingestCredential(user.address, identityCommitment))
        .to.emit(adapter, "KycDataRead")
        .to.emit(adapter, "CredentialIngested");

      expect(await registry.isIdentityRegistered(identityCommitment)).to.be.true;
    });

    it("should reject unapproved user", async function () {
      // User has no KYC
      await expect(
        adapter.ingestCredential(user.address, 12345)
      ).to.be.revertedWith("KYCSBTAdapter: KYC not approved");
    });

    it("should reject revoked user", async function () {
      await mockKyc.setKycInfo(user.address, "alice.hsk", 3, 1);
      await mockKyc.revokeKyc(user.address);

      await expect(
        adapter.ingestCredential(user.address, 12345)
      ).to.be.revertedWith("KYCSBTAdapter: KYC not approved");
    });

    it("should register computed credential", async function () {
      const credHash = 99999;
      await adapter.registerComputedCredential(12345, credHash);
      expect(await registry.isCredentialRegistered(credHash)).to.be.true;
    });

    it("should return correct credential type", async function () {
      expect(await adapter.credentialType()).to.equal(1);
    });
  });
});
