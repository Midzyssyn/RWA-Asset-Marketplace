const hre = require("hardhat");

/**
 * 多公司 RWA 资产市场部署（方案 B：Registry + 脚本部署多套）
 *
 * 流程：MockUSDC → ProjectRegistry → 多套 (RWAShare + RWAVault) → register
 * 各项目共用同一个 MockUSDC；白名单 / nav / 派息 / pause 按项目隔离。
 *
 * 本地：npx hardhat run scripts/deploy.js --network localhost
 * Sepolia：npx hardhat run scripts/deploy.js --network sepolia
 */

/** 种子项目：不同公司名 / 项目名，投资人打开即见「多家公司」 */
const SEED_PROJECTS = [
  {
    name: "东海光伏收益项目",
    description: "屋顶分布式光伏电站未来电费收益权份额（教学演示）",
    companyName: "东海绿能科技",
  },
  {
    name: "江城仓储物流收益项目",
    description: "冷链仓储租金收益权数字化份额（教学演示）",
    companyName: "江城物流控股",
  },
  {
    name: "滨海商业地产租金项目",
    description: "核心商圈写字楼租金收益权份额（教学演示）",
    companyName: "滨海置业集团",
  },
];

async function deployProjectPair(admin, usdcAddr, navManager) {
  const RWAShare = await hre.ethers.getContractFactory("RWAShare");
  const share = await RWAShare.deploy(admin);
  await share.waitForDeployment();

  const RWAVault = await hre.ethers.getContractFactory("RWAVault");
  const vault = await RWAVault.deploy(admin, usdcAddr, await share.getAddress());
  await vault.waitForDeployment();

  const vaultAddr = await vault.getAddress();
  const shareAddr = await share.getAddress();

  const MINTER_ROLE = await share.MINTER_ROLE();
  const BURNER_ROLE = await share.BURNER_ROLE();
  await (await share.grantRole(MINTER_ROLE, vaultAddr)).wait();
  await (await share.grantRole(BURNER_ROLE, vaultAddr)).wait();
  await (await share.setVault(vaultAddr)).wait();

  // setNAV 仅 NAV_MANAGER_ROLE；构造时已授给 admin。演示可再授给独立净值账户（分钥）
  const NAV_MANAGER_ROLE = await vault.NAV_MANAGER_ROLE();
  if (navManager && navManager.toLowerCase() !== admin.toLowerCase()) {
    await (await vault.grantRole(NAV_MANAGER_ROLE, navManager)).wait();
  }

  return { share, vault, shareAddr, vaultAddr, NAV_MANAGER_ROLE };
}

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const admin = deployer.address;
  // 演示分钥：若有第二个账户，授 NAV_MANAGER（仅能改净值，不能 pause/派息）
  const navManagerSigner = signers[2] || signers[0];
  const navManager = navManagerSigner.address;

  console.log("Network:", hre.network.name);
  console.log("Deploying with account:", admin);
  console.log("Demo NAV_MANAGER:", navManager);

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(admin);
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();

  const ProjectRegistry = await hre.ethers.getContractFactory("ProjectRegistry");
  const registry = await ProjectRegistry.deploy(admin);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();

  const deployed = [];
  for (const seed of SEED_PROJECTS) {
    const pair = await deployProjectPair(admin, usdcAddr, navManager);
    await (
      await registry.registerProject(
        seed.name,
        seed.description,
        seed.companyName,
        pair.shareAddr,
        pair.vaultAddr,
        true
      )
    ).wait();
    deployed.push({ ...seed, ...pair });
    console.log(
      `Registered #${deployed.length - 1}: ${seed.companyName} · ${seed.name}`
    );
    console.log(`  Share: ${pair.shareAddr}`);
    console.log(`  Vault: ${pair.vaultAddr}`);
  }

  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();

  console.log("\n--- Deployment Summary ---");
  console.log("MockUSDC:", usdcAddr);
  console.log("ProjectRegistry:", registryAddr);
  console.log("Projects:", deployed.length);
  console.log("Admin (pause / distribute / whitelist / depositsOpen):", admin);
  console.log("NAV_MANAGER (setNAV only; Admin also holds role by default):", navManager);
  console.log("Mode: Registry-only (B) — script deploys pairs then register");
  console.log(
    "Note: setNAV = NAV_MANAGER_ROLE + ±20% + raise solvency; not Chainlink; ≠ distributeYield"
  );

  console.log("\n--- frontend/.env（复制后重启 Vite）---");
  console.log(`VITE_MOCK_USDC_ADDRESS=${usdcAddr}`);
  console.log(`VITE_PROJECT_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`VITE_CHAIN_ID=${chainId}`);
  // 兼容旧单项目 env：指向 #0，便于对照
  console.log(`# optional legacy single-project pointers (project #0)`);
  console.log(`VITE_RWA_SHARE_ADDRESS=${deployed[0].shareAddr}`);
  console.log(`VITE_RWA_VAULT_ADDRESS=${deployed[0].vaultAddr}`);

  if (hre.network.name === "sepolia") {
    console.log("\n--- Etherscan 验证（部署成功后再跑；需 ETHERSCAN_API_KEY）---");
    console.log(`npx hardhat verify --network sepolia ${usdcAddr} ${admin}`);
    console.log(`npx hardhat verify --network sepolia ${registryAddr} ${admin}`);
    for (const p of deployed) {
      console.log(
        `npx hardhat verify --network sepolia ${p.shareAddr} ${admin}`
      );
      console.log(
        `npx hardhat verify --network sepolia ${p.vaultAddr} ${admin} ${usdcAddr} ${p.shareAddr}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
