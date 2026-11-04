/**
 * 临时把项目 #0 Vault pause，方便 UI 截图「柜台暂停」提示。
 * 用法: npx hardhat run scripts/demo-pause-for-ui.js --network localhost
 */
require("dotenv").config({ path: "frontend/.env" });
const hre = require("hardhat");

async function main() {
  const vaultAddr =
    process.env.VITE_RWA_VAULT_ADDRESS ||
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const [admin] = await hre.ethers.getSigners();
  const vault = await hre.ethers.getContractAt("RWAVault", vaultAddr, admin);
  const paused = await vault.paused();
  if (!paused) {
    await (await vault.pause()).wait();
    console.log("paused", vaultAddr);
  } else {
    console.log("already paused", vaultAddr);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
