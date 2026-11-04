const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProjectRegistry", function () {
  async function deployFixture() {
    const [admin, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(admin.address);
    await usdc.waitForDeployment();

    const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    const registry = await ProjectRegistry.deploy(admin.address);
    await registry.waitForDeployment();

    async function deployPair() {
      const RWAShare = await ethers.getContractFactory("RWAShare");
      const share = await RWAShare.deploy(admin.address);
      await share.waitForDeployment();

      const RWAVault = await ethers.getContractFactory("RWAVault");
      const vault = await RWAVault.deploy(
        admin.address,
        await usdc.getAddress(),
        await share.getAddress()
      );
      await vault.waitForDeployment();

      const vaultAddr = await vault.getAddress();
      await share.grantRole(await share.MINTER_ROLE(), vaultAddr);
      await share.grantRole(await share.BURNER_ROLE(), vaultAddr);
      await share.setVault(vaultAddr);

      return { share, vault, shareAddr: await share.getAddress(), vaultAddr };
    }

    return { usdc, registry, admin, other, deployPair };
  }

  it("register + list + get：可登记多个公司项目", async function () {
    const { registry, deployPair } = await deployFixture();
    const a = await deployPair();
    const b = await deployPair();

    await registry.registerProject(
      "东海光伏收益项目",
      "屋顶分布式光伏收益权份额",
      "东海绿能科技",
      a.shareAddr,
      a.vaultAddr,
      true
    );
    await registry.registerProject(
      "江城仓储物流收益项目",
      "冷链仓储租金收益权份额",
      "江城物流控股",
      b.shareAddr,
      b.vaultAddr,
      true
    );

    expect(await registry.projectCount()).to.equal(2n);
    const list = await registry.listProjects();
    expect(list.length).to.equal(2);
    expect(list[0].name).to.equal("东海光伏收益项目");
    expect(list[0].companyName).to.equal("东海绿能科技");
    expect(list[1].companyName).to.equal("江城物流控股");

    const p0 = await registry.getProject(0);
    expect(p0.share).to.equal(a.shareAddr);
    expect(p0.vault).to.equal(a.vaultAddr);
    expect(p0.listed).to.equal(true);
  });

  it("setListed 可下架；非 owner 无法登记", async function () {
    const { registry, other, deployPair } = await deployFixture();
    const a = await deployPair();

    await registry.registerProject(
      "测试项目",
      "简介",
      "测试公司",
      a.shareAddr,
      a.vaultAddr,
      true
    );
    await registry.setListed(0, false);
    expect((await registry.getProject(0)).listed).to.equal(false);

    await expect(
      registry
        .connect(other)
        .registerProject("x", "y", "z", a.shareAddr, a.vaultAddr, true)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("项目 A 认购不影响项目 B 份额与金库资金", async function () {
    const { usdc, registry, admin, other, deployPair } = await deployFixture();
    const a = await deployPair();
    const b = await deployPair();

    await registry.registerProject(
      "项目A",
      "A",
      "公司甲",
      a.shareAddr,
      a.vaultAddr,
      true
    );
    await registry.registerProject(
      "项目B",
      "B",
      "公司乙",
      b.shareAddr,
      b.vaultAddr,
      true
    );

    const assets = ethers.parseUnits("100", 6);
    await a.share.addToWhitelist(other.address);
    await b.share.addToWhitelist(other.address);
    await usdc.mint(other.address, assets * 2n);
    await usdc.connect(other).approve(a.vaultAddr, assets);
    await usdc.connect(other).approve(b.vaultAddr, assets);

    await a.vault.connect(other).deposit(assets);

    expect(await a.share.balanceOf(other.address)).to.equal(assets);
    expect(await b.share.balanceOf(other.address)).to.equal(0n);
    expect(await usdc.balanceOf(a.vaultAddr)).to.equal(assets);
    expect(await usdc.balanceOf(b.vaultAddr)).to.equal(0n);

    // A setNAV（+20% 护栏内 + 注资）不影响 B
    const navUp = 1_200_000n;
    await usdc.mint(a.vaultAddr, ethers.parseUnits("20", 6));
    await a.vault.connect(admin).setNAV(navUp);
    expect(await a.vault.nav()).to.equal(navUp);
    expect(await b.vault.nav()).to.equal(1_000_000n);

    // A pause / 关闭新认购不影响 B 的 deposit
    await a.vault.connect(admin).setDepositsOpen(false);
    await a.vault.connect(admin).pause();
    await expect(a.vault.connect(other).deposit(1n)).to.be.reverted;
    await b.vault.connect(other).deposit(assets);
    expect(await b.share.balanceOf(other.address)).to.equal(assets);
    expect(await b.vault.paused()).to.equal(false);
    expect(await b.vault.depositsOpen()).to.equal(true);
  });

  it("下架后建议关闭新认购：不能 deposit，未 pause 可 redeem", async function () {
    const { usdc, registry, admin, other, deployPair } = await deployFixture();
    const a = await deployPair();

    await registry.registerProject(
      "项目A",
      "A",
      "公司甲",
      a.shareAddr,
      a.vaultAddr,
      true
    );

    const assets = ethers.parseUnits("50", 6);
    await a.share.addToWhitelist(other.address);
    await usdc.mint(other.address, assets);
    await usdc.connect(other).approve(a.vaultAddr, assets);
    await a.vault.connect(other).deposit(assets);

    // 平台下架 + 项目方关闭新认购（产品联调）
    await registry.setListed(0, false);
    expect((await registry.getProject(0)).listed).to.equal(false);
    await a.vault.connect(admin).setDepositsOpen(false);

    await usdc.mint(other.address, assets);
    await usdc.connect(other).approve(a.vaultAddr, assets);
    await expect(a.vault.connect(other).deposit(assets)).to.be.revertedWithCustomError(
      a.vault,
      "DepositsClosed"
    );

    const shares = await a.share.balanceOf(other.address);
    await a.vault.connect(other).redeem(shares);
    expect(await a.share.balanceOf(other.address)).to.equal(0n);
  });
});
