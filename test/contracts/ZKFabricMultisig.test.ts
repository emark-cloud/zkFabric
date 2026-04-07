import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZKFabricMultisig", () => {
  async function deploy() {
    const [a, b, c, d, outsider] = await ethers.getSigners();
    const Multisig = await ethers.getContractFactory("ZKFabricMultisig");
    const multisig = await Multisig.deploy([a.address, b.address, c.address], 2);
    await multisig.waitForDeployment();
    return { multisig, a, b, c, d, outsider };
  }

  it("rejects malformed constructor args", async () => {
    const Multisig = await ethers.getContractFactory("ZKFabricMultisig");
    const [a, b] = await ethers.getSigners();
    await expect(Multisig.deploy([], 1)).to.be.revertedWith("ZKFabricMultisig: no owners");
    await expect(Multisig.deploy([a.address], 2)).to.be.revertedWith("ZKFabricMultisig: bad threshold");
    await expect(Multisig.deploy([a.address, a.address], 1)).to.be.revertedWith("ZKFabricMultisig: duplicate owner");
    await expect(
      Multisig.deploy([a.address, ethers.ZeroAddress], 1)
    ).to.be.revertedWith("ZKFabricMultisig: zero owner");
  });

  it("requires threshold confirmations before execute", async () => {
    const { multisig, a, b, outsider } = await deploy();
    // Target: the multisig's own fallback (noop) — we just want to verify the
    // confirmation + execution flow without side effects.
    const target = await multisig.getAddress();

    // Outsider can't submit
    await expect(
      multisig.connect(outsider).submit(target, 0, "0x")
    ).to.be.revertedWith("ZKFabricMultisig: not owner");

    // a submits (auto-confirms to 1/2)
    const tx = await multisig.connect(a).submit(target, 0, "0x");
    await tx.wait();
    expect(await multisig.transactionCount()).to.equal(1n);
    const before = await multisig.getTransaction(0);
    expect(before.confirmations).to.equal(1n);
    expect(before.executed).to.equal(false);

    // Can't execute with only 1 confirmation
    await expect(multisig.connect(a).execute(0)).to.be.revertedWith(
      "ZKFabricMultisig: below threshold"
    );

    // b confirms -> 2/2
    await multisig.connect(b).confirm(0);
    // a can't double-confirm
    await expect(multisig.connect(a).confirm(0)).to.be.revertedWith(
      "ZKFabricMultisig: already confirmed"
    );

    // execute succeeds
    await expect(multisig.connect(a).execute(0)).to.emit(multisig, "Executed");
    const after = await multisig.getTransaction(0);
    expect(after.executed).to.equal(true);

    // Can't re-execute
    await expect(multisig.connect(a).execute(0)).to.be.revertedWith(
      "ZKFabricMultisig: executed"
    );
  });

  it("can own and operate a ZKFabricRegistry", async () => {
    const { multisig, a, b } = await deploy();
    const Registry = await ethers.getContractFactory("ZKFabricRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Transfer ownership to the multisig
    await registry.transferOwnership(await multisig.getAddress());
    expect(await registry.owner()).to.equal(await multisig.getAddress());

    // Direct EOA calls are now rejected
    await expect(registry.authorizeAdapter(a.address)).to.be.reverted;

    // Route `authorizeAdapter(b)` through the multisig
    const data = registry.interface.encodeFunctionData("authorizeAdapter", [b.address]);
    await multisig.connect(a).submit(await registry.getAddress(), 0, data);
    await multisig.connect(b).confirm(0);
    await multisig.connect(a).execute(0);

    expect(await registry.authorizedAdapters(b.address)).to.equal(true);
  });
});
