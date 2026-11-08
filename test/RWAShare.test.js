const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RWAShare", function () {
  async function deployFixture() {
    const [admin, minter, alice, bob, stranger] = await ethers.getSigners();
    const RWAShare = await ethers.getContractFactory("RWAShare");
    const share = await RWAShare.deploy(admin.address);
    await share.waitForDeployment();

    const MINTER_ROLE = await share.MINTER_ROLE();
    await share.connect(admin).grantRole(MINTER_ROLE, minter.address);

    return { share, admin, minter, alice, bob, stranger, MINTER_ROLE };
  }

  it("decimals 为 6", async function () {
    const { share } = await deployFixture();
    expect(await share.decimals()).to.equal(6);
  });

  it("未白名单 transfer 失败", async function () {
    const { share, admin, minter, alice, bob } = await deployFixture();
    await share.connect(admin).addToWhitelist(alice.address);
    await share.connect(minter).mint(alice.address, ethers.parseUnits("10", 6));

    await expect(
      share.connect(alice).transfer(bob.address, 1)
    ).to.be.revertedWithCustomError(share, "NotWhitelisted");
  });

  it("未白名单 transferFrom 失败", async function () {
    const { share, admin, minter, alice, bob } = await deployFixture();
    const amount = ethers.parseUnits("10", 6);
    await share.connect(admin).addToWhitelist(alice.address);
    await share.connect(minter).mint(alice.address, amount);
    await share.connect(alice).approve(bob.address, amount);

    await expect(
      share.connect(bob).transferFrom(alice.address, bob.address, 1)
    ).to.be.revertedWithCustomError(share, "NotWhitelisted");
  });

  it("双方都在白名单可以转", async function () {
    const { share, admin, minter, alice, bob } = await deployFixture();
    const amount = ethers.parseUnits("10", 6);
    const send = ethers.parseUnits("3", 6);

    await share.connect(admin).addToWhitelistBatch([alice.address, bob.address]);
    await share.connect(minter).mint(alice.address, amount);
    await share.connect(alice).transfer(bob.address, send);

    expect(await share.balanceOf(alice.address)).to.equal(amount - send);
    expect(await share.balanceOf(bob.address)).to.equal(send);
  });

  it("增删白名单发出 WhitelistUpdated", async function () {
    const { share, admin, alice } = await deployFixture();

    await expect(share.connect(admin).addToWhitelist(alice.address))
      .to.emit(share, "WhitelistUpdated")
      .withArgs(alice.address, true);

    await expect(share.connect(admin).removeFromWhitelist(alice.address))
      .to.emit(share, "WhitelistUpdated")
      .withArgs(alice.address, false);

    expect(await share.whitelist(alice.address)).to.equal(false);
  });

  it("有持仓时不能移出白名单；清仓后可移出", async function () {
    const { share, admin, minter, alice } = await deployFixture();
    const amount = ethers.parseUnits("5", 6);

    await share.connect(admin).addToWhitelist(alice.address);
    await share.connect(minter).mint(alice.address, amount);

    await expect(share.connect(admin).removeFromWhitelist(alice.address))
      .to.be.revertedWithCustomError(share, "NonZeroShareBalance")
      .withArgs(alice.address, amount);

    expect(await share.whitelist(alice.address)).to.equal(true);
    expect(await share.balanceOf(alice.address)).to.equal(amount);

    // 清仓（测试里直接 burn；产品路径是 Vault.redeem）
    const BURNER_ROLE = await share.BURNER_ROLE();
    await share.connect(admin).grantRole(BURNER_ROLE, admin.address);
    await share.connect(admin).burn(alice.address, amount);

    await expect(share.connect(admin).removeFromWhitelist(alice.address))
      .to.emit(share, "WhitelistUpdated")
      .withArgs(alice.address, false);

    expect(await share.whitelist(alice.address)).to.equal(false);
    expect(await share.balanceOf(alice.address)).to.equal(0);
  });

  it("没有 MINTER_ROLE 的人 mint 份额失败", async function () {
    const { share, admin, alice, stranger } = await deployFixture();
    await share.connect(admin).addToWhitelist(alice.address);

    await expect(
      share.connect(stranger).mint(alice.address, 1)
    ).to.be.revertedWithCustomError(share, "AccessControlUnauthorizedAccount");
  });

  it("setVault 拒绝零地址；非 Admin 不能 setVault", async function () {
    const { share, admin, stranger } = await deployFixture();

    await expect(share.connect(admin).setVault(ethers.ZeroAddress)).to.be.revertedWith("zero vault");

    await expect(share.connect(stranger).setVault(stranger.address)).to.be.revertedWithCustomError(
      share,
      "AccessControlUnauthorizedAccount"
    );

    await share.connect(admin).setVault(admin.address);
    expect(await share.vault()).to.equal(admin.address);
  });
});
