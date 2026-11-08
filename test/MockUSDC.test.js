const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(owner.address);
    await usdc.waitForDeployment();
    return { usdc, owner, alice, bob };
  }

  it("decimals 为 6", async function () {
    const { usdc } = await deployFixture();
    expect(await usdc.decimals()).to.equal(6);
  });

  it("管理员能给任意地址 mint", async function () {
    const { usdc, alice } = await deployFixture();
    const amount = ethers.parseUnits("1000", 6);
    await usdc.mint(alice.address, amount);
    expect(await usdc.balanceOf(alice.address)).to.equal(amount);
  });

  it("非管理员不能 mint", async function () {
    const { usdc, alice } = await deployFixture();
    await expect(
      usdc.connect(alice).mint(alice.address, 1)
    ).to.be.revertedWithCustomError(usdc, "OwnableUnauthorizedAccount");
  });

  it("无转让限制：任何人可转已持有的 MockUSDC", async function () {
    const { usdc, alice, bob } = await deployFixture();
    const amount = ethers.parseUnits("10", 6);
    await usdc.mint(alice.address, amount);
    await usdc.connect(alice).transfer(bob.address, amount);
    expect(await usdc.balanceOf(bob.address)).to.equal(amount);
  });
});
