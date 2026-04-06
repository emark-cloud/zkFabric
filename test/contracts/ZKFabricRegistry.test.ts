import { expect } from "chai";
import { ethers } from "hardhat";
import { ZKFabricRegistry } from "../../typechain-types";

describe("ZKFabricRegistry", function () {
  let registry: ZKFabricRegistry;
  let owner: any, adapter: any, user: any;

  beforeEach(async function () {
    [owner, adapter, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ZKFabricRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("Adapter Authorization", function () {
    it("should authorize and revoke adapters", async function () {
      await registry.authorizeAdapter(adapter.address);
      expect(await registry.authorizedAdapters(adapter.address)).to.be.true;

      await registry.revokeAdapter(adapter.address);
      expect(await registry.authorizedAdapters(adapter.address)).to.be.false;
    });

    it("should reject unauthorized adapter calls", async function () {
      await expect(
        registry.connect(user).registerIdentity(123)
      ).to.be.revertedWith("ZKFabricRegistry: not authorized adapter");
    });
  });

  describe("Identity Registration", function () {
    beforeEach(async function () {
      await registry.authorizeAdapter(adapter.address);
    });

    it("should register an identity", async function () {
      await expect(registry.connect(adapter).registerIdentity(12345))
        .to.emit(registry, "IdentityRegistered")
        .withArgs(12345);

      expect(await registry.isIdentityRegistered(12345)).to.be.true;
    });

    it("should reject duplicate identity", async function () {
      await registry.connect(adapter).registerIdentity(12345);
      await expect(
        registry.connect(adapter).registerIdentity(12345)
      ).to.be.revertedWith("ZKFabricRegistry: identity already registered");
    });

    it("should reject zero commitment", async function () {
      await expect(
        registry.connect(adapter).registerIdentity(0)
      ).to.be.revertedWith("ZKFabricRegistry: zero commitment");
    });
  });

  describe("Credential Registration", function () {
    beforeEach(async function () {
      await registry.authorizeAdapter(adapter.address);
    });

    it("should register a credential", async function () {
      const identityCommitment = 111;
      const credentialHash = 222;

      await expect(
        registry.connect(adapter).registerCredential(identityCommitment, credentialHash)
      )
        .to.emit(registry, "CredentialRegistered")
        .withArgs(identityCommitment, credentialHash, adapter.address);

      expect(await registry.isCredentialRegistered(credentialHash)).to.be.true;
      expect(await registry.credentialCount()).to.equal(1);
    });

    it("should reject duplicate credential", async function () {
      await registry.connect(adapter).registerCredential(111, 222);
      await expect(
        registry.connect(adapter).registerCredential(111, 222)
      ).to.be.revertedWith("ZKFabricRegistry: credential already registered");
    });
  });

  describe("Root Management", function () {
    it("should update and validate roots", async function () {
      await registry.updateRoot(1000);
      expect(await registry.currentRoot()).to.equal(1000);
      expect(await registry.isValidRoot(1000)).to.be.true;

      await registry.updateRoot(2000);
      expect(await registry.currentRoot()).to.equal(2000);
      // Both roots should be valid
      expect(await registry.isValidRoot(1000)).to.be.true;
      expect(await registry.isValidRoot(2000)).to.be.true;
    });

    it("should evict old roots after 100 updates", async function () {
      // Insert 100 roots
      for (let i = 1; i <= 100; i++) {
        await registry.updateRoot(i);
      }
      expect(await registry.isValidRoot(1)).to.be.true;

      // 101st root should evict root #1
      await registry.updateRoot(101);
      expect(await registry.isValidRoot(1)).to.be.false;
      expect(await registry.isValidRoot(2)).to.be.true;
      expect(await registry.isValidRoot(101)).to.be.true;
    });

    it("should reject zero root", async function () {
      await expect(registry.updateRoot(0)).to.be.revertedWith(
        "ZKFabricRegistry: zero root"
      );
    });

    it("should reject non-owner root updates", async function () {
      await expect(
        registry.connect(user).updateRoot(1000)
      ).to.be.reverted;
    });
  });
});
