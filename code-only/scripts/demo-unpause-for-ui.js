require("dotenv").config({ path: "frontend/.env" });
const hre = require("hardhat");

async function main() {
  const vaultAddr =
    process.env.VITE_RWA_VAULT_ADDRESS ||
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const [admin] = await hre.ethers.getSigners();
  const vault = await hre.ethers.getContractAt("RWAVault", vaultAddr, admin);
  if (await vault.paused()) {
    await (await vault.unpause()).wait();
    console.log("unpaused", vaultAddr);
  } else {
    console.log("already open", vaultAddr);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
