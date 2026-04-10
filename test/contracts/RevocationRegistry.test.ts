import { expect } from "chai";
import { ethers } from "hardhat";

describe("RevocationRegistry", function () {
  let revocation: any;
  let owner: any, issuer: any, user: any;

  beforeEach(async function () {
    [owner, issuer, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RevocationRegistry");
    revocation = await Factory.deploy();
    await revocation.waitForDeployment();
  });

  it("should authorize issuers", async function () {
    await revocation.authorizeIssuer(issuer.address);
    expect(await revocation.authorizedIssuers(issuer.address)).to.be.true;
  });

  it("should revoke and restore credentials", async function () {
    await revocation.authorizeIssuer(issuer.address);
    const credHash = 12345;

    await expect(revocation.connect(issuer).revoke(credHash))
      .to.emit(revocation, "CredentialRevoked")
      .withArgs(credHash, issuer.address);
    expect(await revocation.isRevoked(credHash)).to.be.true;

    await expect(revocation.connect(issuer).restore(credHash))
      .to.emit(revocation, "CredentialRestored")
      .withArgs(credHash, issuer.address);
    expect(await revocation.isRevoked(credHash)).to.be.false;
  });

  it("should allow owner to revoke without being an authorized issuer", async function () {
    await revocation.revoke(12345);
    expect(await revocation.isRevoked(12345)).to.be.true;
  });

  it("should allow any caller to revoke (open for demo)", async function () {
    await expect(
      revocation.connect(user).revoke(12345)
    ).to.not.be.reverted;
    expect(await revocation.isRevoked(12345)).to.be.true;
  });

  it("should reject double revocation", async function () {
    await revocation.revoke(12345);
    await expect(revocation.revoke(12345)).to.be.revertedWith(
      "RevocationRegistry: already revoked"
    );
  });

  it("should revoke and restore Merkle roots", async function () {
    await revocation.authorizeIssuer(issuer.address);
    const root = 999n;

    await expect(revocation.connect(issuer).revokeRoot(root))
      .to.emit(revocation, "RootRevoked")
      .withArgs(root, issuer.address);
    expect(await revocation.isRootRevoked(root)).to.be.true;

    await expect(revocation.connect(issuer).restoreRoot(root))
      .to.emit(revocation, "RootRestored")
      .withArgs(root, issuer.address);
    expect(await revocation.isRootRevoked(root)).to.be.false;
  });

  it("should reject zero root and double root revocation", async function () {
    await expect(revocation.revokeRoot(0)).to.be.revertedWith(
      "RevocationRegistry: zero root"
    );
    await revocation.revokeRoot(7);
    await expect(revocation.revokeRoot(7)).to.be.revertedWith(
      "RevocationRegistry: root already revoked"
    );
  });

  it("should revoke and restore nullifiers", async function () {
    await revocation.authorizeIssuer(issuer.address);
    const nullifier = 42n;

    await expect(revocation.connect(issuer).revokeNullifier(nullifier))
      .to.emit(revocation, "NullifierRevoked")
      .withArgs(nullifier, issuer.address);
    expect(await revocation.isNullifierRevoked(nullifier)).to.be.true;

    await revocation.connect(issuer).restoreNullifier(nullifier);
    expect(await revocation.isNullifierRevoked(nullifier)).to.be.false;
  });

  it("should allow any caller to revoke root (open for demo)", async function () {
    await expect(
      revocation.connect(user).revokeRoot(123)
    ).to.not.be.reverted;
    expect(await revocation.isRootRevoked(123)).to.be.true;
  });
});
