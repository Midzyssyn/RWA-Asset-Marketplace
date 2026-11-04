const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RWAVault", function () {
  const NAV_ONE = 1_000_000n; // 1e6
  const NAV_UP = 1_200_000n; // +20%（护栏上限内）
  const NAV_DOWN = 800_000n; // -20%
  const NAV_TOO_HIGH = 1_500_000n; // +50%，超幅度
  const NAV_TWO = 2_000_000n; // 历史 2x，现应被相对变动护栏拒绝

  async function deployFixture() {
    const [admin, alice, bob, stranger, navOps] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(admin.address);
    await usdc.waitForDeployment();

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
    await share.connect(admin).grantRole(await share.MINTER_ROLE(), vaultAddr);
    await share.connect(admin).grantRole(await share.BURNER_ROLE(), vaultAddr);
    await share.setVault(vaultAddr);

    return { usdc, share, vault, admin, alice, bob, stranger, navOps, vaultAddr };
  }

  async function fundAndWhitelist(usdc, share, admin, user, amount) {
    await share.connect(admin).addToWhitelist(user.address);
    await usdc.connect(admin).mint(user.address, amount);
  }

  /** 抬价前按偿付不变量补足：principal(newNav) + unclaimed - bal */
  async function topUpForNav(usdc, share, vault, admin, vaultAddr, newNav) {
    const supply = await share.totalSupply();
    const unclaimed = await vault.unclaimedYieldAccounting();
    const needed = (supply * newNav) / NAV_ONE + unclaimed;
    const bal = await usdc.balanceOf(vaultAddr);
    if (needed > bal) {
      await usdc.connect(admin).mint(vaultAddr, needed - bal);
    }
  }

  it("初始 nav 为 1e6", async function () {
    const { vault } = await deployFixture();
    expect(await vault.nav()).to.equal(NAV_ONE);
  });

  it("nav=1e6 时白名单用户 approve 后 deposit：份额约等于 assets，金库 USDC 增加", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);

    await expect(vault.connect(alice).deposit(assets))
      .to.emit(vault, "Deposited")
      .withArgs(alice.address, assets, assets);

    expect(await share.balanceOf(alice.address)).to.equal(assets);
    expect(await usdc.balanceOf(vaultAddr)).to.equal(assets);
    expect(await usdc.balanceOf(alice.address)).to.equal(0n);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { usdc, share, vault, admin, alice } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);
    await fundAndWhitelist(usdc, share, admin, alice, assets);

    await expect(vault.connect(alice).deposit(assets)).to.be.reverted;
  });

  it("未白名单时 deposit 失败", async function () {
    const { usdc, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);
    await usdc.connect(admin).mint(alice.address, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);

    await expect(vault.connect(alice).deposit(assets))
      .to.be.revertedWithCustomError(vault, "NotWhitelisted")
      .withArgs(alice.address);
  });

  it("redeem 后份额销毁、按当前 nav 退回 USDC", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    const shares = await share.balanceOf(alice.address);
    await expect(vault.connect(alice).redeem(shares))
      .to.emit(vault, "Redeemed")
      .withArgs(alice.address, shares, assets);

    expect(await share.balanceOf(alice.address)).to.equal(0n);
    expect(await usdc.balanceOf(alice.address)).to.equal(assets);
    expect(await usdc.balanceOf(vaultAddr)).to.equal(0n);
  });

  it("NAV_MANAGER setNAV 成功并发 NavUpdated；非 NAV 角色调用失败", async function () {
    const { vault, admin, stranger, navOps } = await deployFixture();
    const NAV_MANAGER_ROLE = await vault.NAV_MANAGER_ROLE();

    // 部署时 admin 已有 NAV_MANAGER_ROLE
    await expect(vault.connect(admin).setNAV(NAV_UP))
      .to.emit(vault, "NavUpdated")
      .withArgs(NAV_ONE, NAV_UP);
    expect(await vault.nav()).to.equal(NAV_UP);

    await expect(vault.connect(stranger).setNAV(NAV_ONE)).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );

    // 仅 DEFAULT_ADMIN、无 NAV_MANAGER 时也不能 setNAV
    await vault.connect(admin).revokeRole(NAV_MANAGER_ROLE, admin.address);
    await expect(vault.connect(admin).setNAV(NAV_ONE)).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );

    // Admin 可授 NAV_MANAGER 给演示账户
    await vault.connect(admin).grantRole(NAV_MANAGER_ROLE, navOps.address);
    await expect(vault.connect(navOps).setNAV(NAV_ONE))
      .to.emit(vault, "NavUpdated")
      .withArgs(NAV_UP, NAV_ONE);
  });

  it("setNAV(+20%) 后再 deposit：份额按新 nav 换算；改价后赎回额随之变化", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("120", 6);
    // shares = 120e6 * 1e6 / 1.2e6 = 100e6
    const expectedShares = ethers.parseUnits("100", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets * 2n);
    await vault.connect(admin).setNAV(NAV_UP);

    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    expect(await share.balanceOf(alice.address)).to.equal(expectedShares);

    const redeemAssets = (expectedShares * NAV_UP) / NAV_ONE;
    expect(redeemAssets).to.equal(assets);

    await expect(vault.connect(alice).redeem(expectedShares))
      .to.emit(vault, "Redeemed")
      .withArgs(alice.address, expectedShares, assets);

    expect(await usdc.balanceOf(alice.address)).to.equal(assets * 2n);
  });

  it("先按 nav=1e6 申购，抬价后再赎回：同份额兑出更多 USDC（演示喂价影响）", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    const shares = await share.balanceOf(alice.address);
    expect(shares).to.equal(assets);

    await topUpForNav(usdc, share, vault, admin, vaultAddr, NAV_UP);
    await vault.connect(admin).setNAV(NAV_UP);

    const expectedOut = (shares * NAV_UP) / NAV_ONE;
    expect(expectedOut).to.equal(ethers.parseUnits("120", 6));

    await expect(vault.connect(alice).redeem(shares))
      .to.emit(vault, "Redeemed")
      .withArgs(alice.address, shares, expectedOut);
    expect(await usdc.balanceOf(alice.address)).to.equal(expectedOut);
  });

  it("超幅度 setNAV 失败；抬价偿付不足时 setNAV 失败", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);

    await expect(vault.connect(admin).setNAV(NAV_TOO_HIGH))
      .to.be.revertedWithCustomError(vault, "NavChangeTooLarge")
      .withArgs(NAV_ONE, NAV_TOO_HIGH);

    await expect(vault.connect(admin).setNAV(NAV_TWO))
      .to.be.revertedWithCustomError(vault, "NavChangeTooLarge")
      .withArgs(NAV_ONE, NAV_TWO);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    // 幅度合法但未注资：偿付不足
    await expect(vault.connect(admin).setNAV(NAV_UP))
      .to.be.revertedWithCustomError(vault, "InsufficientReserve");

    // 注资后成功；压价不要求额外偿付
    await topUpForNav(usdc, share, vault, admin, vaultAddr, NAV_UP);
    await vault.connect(admin).setNAV(NAV_UP);
    await vault.connect(admin).setNAV(NAV_ONE); // -16.7% 内
    await vault.connect(admin).setNAV(NAV_DOWN);
  });

  it("非 Admin 不能 pause / unpause / distributeYield；pause/派息与 NAV 角色分钥", async function () {
    const { usdc, share, vault, admin, alice, stranger, navOps, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("10", 6);
    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    const NAV_MANAGER_ROLE = await vault.NAV_MANAGER_ROLE();
    await vault.connect(admin).grantRole(NAV_MANAGER_ROLE, navOps.address);
    // 仅有 NAV 角色者不能 pause / distribute
    await expect(vault.connect(navOps).pause()).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );
    await expect(vault.connect(stranger).pause()).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );
    await expect(vault.connect(stranger).unpause()).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );

    await usdc.connect(admin).mint(stranger.address, assets);
    await usdc.connect(stranger).approve(vaultAddr, assets);
    await expect(vault.connect(stranger).distributeYield(assets)).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("未白名单不能 claimYield；零金额 claim 失败", async function () {
    const { usdc, share, vault, admin, alice, stranger, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("50", 6);
    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    await expect(vault.connect(stranger).claimYield())
      .to.be.revertedWithCustomError(vault, "NotWhitelisted")
      .withArgs(stranger.address);

    await expect(vault.connect(alice).claimYield()).to.be.revertedWithCustomError(vault, "ZeroAmount");
  });

  it("关闭新认购后不能 deposit，未 pause 时可 redeem / claimYield；pause 后主路径失败", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("100", 6);
    const yieldAmount = ethers.parseUnits("10", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(ethers.parseUnits("40", 6));

    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);
    await vault.connect(admin).distributeYield(yieldAmount);

    // 仅关闭新认购（模拟下架联调）：不能新申购，仍可赎回与领息
    await expect(vault.connect(admin).setDepositsOpen(false))
      .to.emit(vault, "DepositsOpenUpdated")
      .withArgs(false);
    expect(await vault.depositsOpen()).to.equal(false);

    await expect(vault.connect(alice).deposit(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
      vault,
      "DepositsClosed"
    );

    const pending = await vault.pendingYield(alice.address);
    expect(pending).to.be.gt(0n);
    await vault.connect(alice).claimYield();

    const bal = await share.balanceOf(alice.address);
    await vault.connect(alice).redeem(bal / 2n);
    expect(await share.balanceOf(alice.address)).to.equal(bal - bal / 2n);

    // pause 后主路径全部失败
    await vault.connect(admin).setDepositsOpen(true);
    await usdc.connect(admin).mint(admin.address, ethers.parseUnits("10", 6));
    await usdc.connect(admin).approve(vaultAddr, ethers.parseUnits("10", 6));
    await vault.connect(admin).pause();

    await expect(vault.connect(alice).deposit(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
      vault,
      "EnforcedPause"
    );
    await expect(vault.connect(alice).redeem(1n)).to.be.revertedWithCustomError(vault, "EnforcedPause");
    await expect(vault.connect(admin).setNAV(NAV_UP)).to.be.revertedWithCustomError(vault, "EnforcedPause");
    await expect(vault.connect(admin).distributeYield(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
      vault,
      "EnforcedPause"
    );
    await expect(vault.connect(alice).claimYield()).to.be.revertedWithCustomError(vault, "EnforcedPause");

    await vault.connect(admin).unpause();
    await vault.connect(alice).deposit(ethers.parseUnits("10", 6));
    await vault.connect(admin).setNAV(NAV_ONE);
  });

  it("无派息时偿付：Vault USDC >= totalSupply * nav / 1e6；nav=1e6 时相等", async function () {
    const { usdc, share, vault, admin, alice, vaultAddr } = await deployFixture();
    const assets = ethers.parseUnits("250", 6);

    await fundAndWhitelist(usdc, share, admin, alice, assets);
    await usdc.connect(alice).approve(vaultAddr, assets);
    await vault.connect(alice).deposit(assets);

    const totalSupply = await share.totalSupply();
    const nav = await vault.nav();
    const vaultBal = await usdc.balanceOf(vaultAddr);
    const liability = (totalSupply * nav) / NAV_ONE;

    expect(vaultBal).to.be.gte(liability);
    expect(nav).to.equal(NAV_ONE);
    expect(vaultBal).to.equal(totalSupply);
  });

  it("setNAV(0) 失败", async function () {
    const { vault, admin } = await deployFixture();
    await expect(vault.connect(admin).setNAV(0n)).to.be.revertedWithCustomError(vault, "ZeroNav");
  });

  // --- 阶段 04：派息（与 setNAV 分轨）---

  it("两人各 50% 份额，注入 100 USDC 利息，每人领约 50（允许 1 单位误差）", async function () {
    const { usdc, share, vault, admin, alice, bob, vaultAddr } = await deployFixture();
    const depositEach = ethers.parseUnits("100", 6);
    const yieldAmount = ethers.parseUnits("100", 6);
    const expectedEach = ethers.parseUnits("50", 6);

    await fundAndWhitelist(usdc, share, admin, alice, depositEach);
    await fundAndWhitelist(usdc, share, admin, bob, depositEach);
    await usdc.connect(alice).approve(vaultAddr, depositEach);
    await usdc.connect(bob).approve(vaultAddr, depositEach);
    await vault.connect(alice).deposit(depositEach);
    await vault.connect(bob).deposit(depositEach);

    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);

    const supply = await share.totalSupply();
    const expectedIndex = (yieldAmount * 10n ** 18n) / supply;
    await expect(vault.connect(admin).distributeYield(yieldAmount))
      .to.emit(vault, "YieldDistributed")
      .withArgs(yieldAmount, expectedIndex);

    const alicePending = await vault.pendingYield(alice.address);
    const bobPending = await vault.pendingYield(bob.address);
    expect(alicePending).to.be.closeTo(expectedEach, 1n);
    expect(bobPending).to.be.closeTo(expectedEach, 1n);

    const aliceUsdcBefore = await usdc.balanceOf(alice.address);
    await expect(vault.connect(alice).claimYield())
      .to.emit(vault, "YieldClaimed")
      .withArgs(alice.address, alicePending);
    expect(await usdc.balanceOf(alice.address)).to.equal(aliceUsdcBefore + alicePending);

    const bobUsdcBefore = await usdc.balanceOf(bob.address);
    await expect(vault.connect(bob).claimYield())
      .to.emit(vault, "YieldClaimed")
      .withArgs(bob.address, bobPending);
    expect(await usdc.balanceOf(bob.address)).to.equal(bobUsdcBefore + bobPending);
  });

  it("无人持仓时 distributeYield 失败", async function () {
    const { usdc, vault, admin, vaultAddr } = await deployFixture();
    const yieldAmount = ethers.parseUnits("10", 6);
    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);

    await expect(vault.connect(admin).distributeYield(yieldAmount)).to.be.revertedWithCustomError(
      vault,
      "NoShares"
    );
  });

  it("A 把份额转给 B 前双方先结息：未领利息不丢、不带走", async function () {
    const { usdc, share, vault, admin, alice, bob, vaultAddr } = await deployFixture();
    const depositA = ethers.parseUnits("100", 6);
    const yieldAmount = ethers.parseUnits("20", 6);
    const half = ethers.parseUnits("50", 6);

    await fundAndWhitelist(usdc, share, admin, alice, depositA);
    await share.connect(admin).addToWhitelist(bob.address);
    await usdc.connect(alice).approve(vaultAddr, depositA);
    await vault.connect(alice).deposit(depositA);

    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);
    await vault.connect(admin).distributeYield(yieldAmount);

    const aliceOwedBefore = await vault.pendingYield(alice.address);
    expect(aliceOwedBefore).to.be.closeTo(yieldAmount, 1n);
    expect(await vault.pendingYield(bob.address)).to.equal(0n);

    await share.connect(alice).transfer(bob.address, half);

    expect(await vault.pendingYield(alice.address)).to.be.closeTo(aliceOwedBefore, 1n);
    expect(await vault.claimable(alice.address)).to.be.closeTo(aliceOwedBefore, 1n);
    expect(await vault.pendingYield(bob.address)).to.equal(0n);

    await vault.connect(alice).claimYield();
    expect(await usdc.balanceOf(alice.address)).to.be.closeTo(aliceOwedBefore, 1n);

    await expect(vault.connect(bob).claimYield()).to.be.revertedWithCustomError(vault, "ZeroAmount");
  });

  it("注入并部分领取后：金库 USDC >= 按 nav 计价本金 + 尚未领走的利息", async function () {
    const { usdc, share, vault, admin, alice, bob, vaultAddr } = await deployFixture();
    const depositEach = ethers.parseUnits("100", 6);
    const yieldAmount = ethers.parseUnits("100", 6);

    await fundAndWhitelist(usdc, share, admin, alice, depositEach);
    await fundAndWhitelist(usdc, share, admin, bob, depositEach);
    await usdc.connect(alice).approve(vaultAddr, depositEach);
    await usdc.connect(bob).approve(vaultAddr, depositEach);
    await vault.connect(alice).deposit(depositEach);
    await vault.connect(bob).deposit(depositEach);

    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);
    await vault.connect(admin).distributeYield(yieldAmount);

    await vault.connect(alice).claimYield();

    const totalSupply = await share.totalSupply();
    const currentNav = await vault.nav();
    const principal = (totalSupply * currentNav) / NAV_ONE;
    const unclaimed = await vault.unclaimedYieldAccounting();
    const vaultBal = await usdc.balanceOf(vaultAddr);

    expect(vaultBal).to.be.gte(principal + unclaimed);
  });

  it("改 nav 后派息会计仍独立正确（改价不等于自动发息）", async function () {
    const { usdc, share, vault, admin, alice, bob, vaultAddr } = await deployFixture();
    const depositEach = ethers.parseUnits("100", 6);
    const yieldAmount = ethers.parseUnits("40", 6);

    await fundAndWhitelist(usdc, share, admin, alice, depositEach);
    await fundAndWhitelist(usdc, share, admin, bob, depositEach);
    await usdc.connect(alice).approve(vaultAddr, depositEach);
    await usdc.connect(bob).approve(vaultAddr, depositEach);
    await vault.connect(alice).deposit(depositEach);
    await vault.connect(bob).deposit(depositEach);

    await usdc.connect(admin).mint(admin.address, yieldAmount);
    await usdc.connect(admin).approve(vaultAddr, yieldAmount);
    await vault.connect(admin).distributeYield(yieldAmount);

    const pendingBeforeNav = await vault.pendingYield(alice.address);

    // 改 nav 不应改变待领利息（须先注资以满足抬价偿付）
    await topUpForNav(usdc, share, vault, admin, vaultAddr, NAV_UP);
    await vault.connect(admin).setNAV(NAV_UP);
    expect(await vault.pendingYield(alice.address)).to.equal(pendingBeforeNav);
    expect(await vault.pendingYield(bob.address)).to.equal(pendingBeforeNav);

    const moreYield = ethers.parseUnits("20", 6);
    await usdc.connect(admin).mint(admin.address, moreYield);
    await usdc.connect(admin).approve(vaultAddr, moreYield);
    await vault.connect(admin).distributeYield(moreYield);

    const expected = ethers.parseUnits("30", 6);
    expect(await vault.pendingYield(alice.address)).to.be.closeTo(expected, 1n);
    expect(await vault.pendingYield(bob.address)).to.be.closeTo(expected, 1n);

    const aliceShares = await share.balanceOf(alice.address);
    const principalOut = (aliceShares * NAV_UP) / NAV_ONE;
    const yieldOut = await vault.pendingYield(alice.address);

    await vault.connect(alice).claimYield();
    const usdcAfterClaim = await usdc.balanceOf(alice.address);

    await vault.connect(alice).redeem(aliceShares);
    expect(await usdc.balanceOf(alice.address)).to.equal(usdcAfterClaim + principalOut);
    expect(yieldOut).to.be.closeTo(expected, 1n);
  });
});
