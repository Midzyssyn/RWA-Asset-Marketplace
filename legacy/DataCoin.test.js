const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DataCoin", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();
    const DataCoin = await ethers.getContractFactory("DataCoin");
    const coin = await DataCoin.deploy(owner.address);
    await coin.waitForDeployment();
    return { coin, owner, user };
  }

  it("name / symbol 正确", async function () {
    const { coin } = await deployFixture();
    expect(await coin.name()).to.equal("Data Coin");
    expect(await coin.symbol()).to.equal("DATA");
  });

  it("owner 可以 mint", async function () {
    const { coin, user } = await deployFixture();
    const amount = ethers.parseEther("100");
    await coin.mint(user.address, amount);
    expect(await coin.balanceOf(user.address)).to.equal(amount);
  });

  it("非 owner 不能 mint", async function () {
    const { coin, user } = await deployFixture();
    await expect(
      coin.connect(user).mint(user.address, 1)
    ).to.be.revertedWithCustomError(coin, "OwnableUnauthorizedAccount");
  });
});
