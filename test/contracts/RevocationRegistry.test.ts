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

  it("should reject unauthorized revocation", async function () {
    await expect(
      revocation.connect(user).revoke(12345)
    ).to.be.revertedWith("RevocationRegistry: not authorized");
  });

  it("should reject double revocation", async function () {
    await revocation.revoke(12345);
    await expect(revocation.revoke(12345)).to.be.revertedWith(
      "RevocationRegistry: already revoked"
    );
  });
});
