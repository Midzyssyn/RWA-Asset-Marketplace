const hre = require("hardhat");

/**
 * 演示用：给 Admin / Investor 在所有已登记项目上做投资者准入，并 mint 测试 USDC
 *
 * 用法：
 *   先设置：VITE_MOCK_USDC_ADDRESS、VITE_PROJECT_REGISTRY_ADDRESS
 *   npx hardhat run scripts/seed-demo.js --network localhost
 */
async function main() {
  const signers = await hre.ethers.getSigners();
  const admin = signers[0];
  const investor = signers[1] || admin;

  const usdcAddr = process.env.VITE_MOCK_USDC_ADDRESS || process.env.MOCK_USDC_ADDRESS;
  const registryAddr =
    process.env.VITE_PROJECT_REGISTRY_ADDRESS || process.env.PROJECT_REGISTRY_ADDRESS;

  if (!usdcAddr || !registryAddr) {
    throw new Error(
      "请先设置已部署地址：VITE_MOCK_USDC_ADDRESS、VITE_PROJECT_REGISTRY_ADDRESS"
    );
  }

  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddr);
  const registry = await hre.ethers.getContractAt("ProjectRegistry", registryAddr);

  const count = Number(await registry.projectCount());
  if (count === 0) {
    throw new Error("Registry 中尚无项目，请先运行 deploy.js");
  }

  for (let i = 0; i < count; i++) {
    const p = await registry.getProject(i);
    const share = await hre.ethers.getContractAt("RWAShare", p.share);
    await (await share.addToWhitelist(admin.address)).wait();
    if (investor.address !== admin.address) {
      await (await share.addToWhitelist(investor.address)).wait();
    }
    console.log(
      `[#${i}] ${p.companyName} · ${p.name} — 投资者准入完成 (share ${p.share})`
    );
  }

  await (await usdc.mint(investor.address, 1000n * 10n ** 6n)).wait();
  await (await usdc.mint(admin.address, 500n * 10n ** 6n)).wait();

  console.log("\nAdmin:", admin.address);
  console.log("Investor:", investor.address);
  console.log("Investor USDC:", (await usdc.balanceOf(investor.address)).toString());
  console.log("Admin USDC:", (await usdc.balanceOf(admin.address)).toString());
  console.log("Projects seeded:", count);
  console.log(
    "Note: setNAV 需 NAV_MANAGER_ROLE（部署时已授 Admin；可用 grantRole 拆给演示净值账户）"
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
