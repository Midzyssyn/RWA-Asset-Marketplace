# RWA 资产市场（多公司资产数字化）

以太坊上的 **多公司 RWA 资产收益权认购** 教学演示：多家公司把资产收益权做成可认购份额项目；投资人在市场页浏览、点进项目完成投资者准入后认购 / 赎回 / 领取收益。

> **诚实边界（必读）**  
> - 教学演示，**非**真实证券产品  
> - 使用 **MockUSDC**，不是真美元  
> - **每个项目 `NAV_MANAGER_ROLE` 中心化 `setNAV`**（±20% + 抬价偿付护栏），不是 Chainlink；与 pause/派息分钥
> - 投资者准入（白名单）≠ 真实 KYC  
> - 信任假设落在各项目 Admin / 平台 Registry Owner 密钥

> **需求技术文档（范围 / 角色 / 功能与验收）：** [docs/需求技术文档.md](./docs/需求技术文档.md)  
> **作业交付材料（测试输出、扫描、本地地址；无截图）：** [docs/作业交付材料.md](./docs/作业交付材料.md)  
> 总设计：[docs/RWA-技术设计.md](./docs/RWA-技术设计.md)  
> **规则边界（下架≠暂停 / setNAV / 角色 / 范围外）**：[docs/下架与暂停对照.md](./docs/下架与暂停对照.md)  
> 运维 / 不可升级：[docs/运维与升级说明.md](./docs/运维与升级说明.md)  
> 演示路径：[docs/演示脚本.md](./docs/演示脚本.md)  
> 分阶段日志：[project-log/README.md](./project-log/README.md)

---

## 产品故事

1. 打开 **RWA 资产市场**，看到多家公司上架的资产项目（如光伏收益、仓储物流、商业地产租金）。  
2. 点进某一公司的项目，完成 **投资者准入** 后：**认购资产项目** / **赎回投资** / **领取项目收益**。  
3. 项目方可 **更新项目份额净值**、**分配收益**、**暂停柜台**（互不影响其它项目）。

---

## 架构（必遵守）

| 约定 | 说明 |
|------|------|
| 一项目一套金库 | 每个上架项目 = 独立 `RWAShare` + `RWAVault`，**共用同一个 `MockUSDC`** |
| 目录层 | `ProjectRegistry` 登记：项目名、简介、公司名、share、vault、是否上架；提供 `list` / `get` |
| 创建方式 | **B）仅 Registry**：部署脚本先部署多套 Share+Vault，再 `register` 进目录（不用 Factory） |
| 隔离 | 白名单 / nav / 派息 / pause 仍在各自 Vault/Share，按项目隔离 |
| 不做 | 项目间转份额、二级订单簿、真实 KYC、Chainlink、跨项目合并金库 |

**未改**已有 Vault 的 nav 公式与派息分轨；市场层不合并成巨无霸合约。

---

## 功能范围

| 纳入 | 不做 |
|------|------|
| 多项目市场列表、项目详情认购 | 真实 KYC / 证件存储 |
| 投资者准入、申购、赎回、暂停、简易派息 | Chainlink 等外部预言机 |
| 每项目 Admin `setNAV`（中心化净值） | 主网、真美元、真证券 |
| MockUSDC、Hardhat 本地 / Sepolia | 二级订单簿、代理升级 |

---

## 项目结构

```text
contracts/     MockUSDC · RWAShare · RWAVault · ProjectRegistry
scripts/       deploy.js（多项目种子） · seed-demo.js
test/          合约单测（含 Registry 隔离验收）
frontend/      市场 / 项目详情 / Admin
docs/          技术设计、运维、演示、威胁与扫描
```

---

## 环境变量

根目录 `.env`（部署 Sepolia 用，已 gitignore）：

| 变量名 | 用途 |
|--------|------|
| `SEPOLIA_RPC_URL` | Sepolia HTTP RPC |
| `PRIVATE_KEY` | 部署账户私钥（仅测试网） |
| `ETHERSCAN_API_KEY` | 源码验证 |

前端 `frontend/.env`（部署成功后填入）：

| 变量名 | 说明 |
|--------|------|
| `VITE_MOCK_USDC_ADDRESS` | 共用 MockUSDC |
| `VITE_PROJECT_REGISTRY_ADDRESS` | 项目目录 |
| `VITE_CHAIN_ID` | 本地 `31337` / Sepolia `11155111` |

各项目的 Share / Vault **不写死在 env**，由前端从 Registry 读取。

---

## 部署地址

**当前已部署：Hardhat 本地（31337）+ Sepolia（11155111）。** 本地一次部署记录与测试/扫描证据见 [docs/作业交付材料.md](./docs/作业交付材料.md)。

| 合约 | 本地 localhost（常见首次部署地址） | Sepolia（2026-11-08 现行） |
|------|------|---------|
| MockUSDC | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | `0xe943969d85cE2427a04C60440a912e1529d2350C` |
| ProjectRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | `0x1A21801403140A9170c50D8cbdB1aeca31a11918` |
| 各项目 Share/Vault | Registry `listProjects` / 交付材料 §6.2 | 见下表；教程 [docs/Sepolia部署教程.md](./docs/Sepolia部署教程.md) |

Sepolia 三项目（Admin / NAV_MANAGER：`0x19de368943D563dF5A7Ee78bB1fEdD7901899d92`）：

| 项目 | Share | Vault |
|------|-------|-------|
| 东海绿能 · 东海光伏收益 | `0x1c10ed637763551a0d13A6BdA42765a20E31b534` | `0x6599413e12a6923A1600D57147f2858723DCAa8B` |
| 江城物流 · 江城仓储物流收益 | `0x4D77c3B84Cdb36b65700C749034eF022d3A589cE` | `0xD15Aa4C0Cb65c9b79fe5640e1C6BD02cD265fDD3` |
| 滨海置业 · 滨海商业地产租金 | `0x72ddD60EefcbC397fbA6b8f7645ef946848a93c7` | `0xcF2bEB331F7f6e47be13843a1E773EDB8eA73830` |

本地部署者（平台 + 各项目 Admin）：`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`  
演示 NAV_MANAGER：`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`  
初始每项目 `nav = 1e6`（1 份额 = 1 MockUSDC）。本地节点重启后须重新 `deploy`。

---

## 本地复现

```bash
# 1. 安装
npm install
cd frontend && npm install && cd ..

# 2. 编译与测试
npm run compile
npm test

# 3. 本地链 + 部署（两终端）——会登记 ≥3 个不同公司示例项目
npm run node
npm run deploy:local

# 4. 种子：投资者准入 + mint MockUSDC
#    把部署打印的地址写入环境变量后
npx hardhat run scripts/seed-demo.js --network localhost

# 5. 前端：写入 frontend/.env 后
npm run dev:frontend
```

### 演示路径（浏览市场 → 进项目 → 认购）

1. 打开首页 **RWA 资产市场**，应看到 ≥2 个项目、分属不同公司文案。  
2. 点「查看并认购」进入 `/project/:id`。  
3. Admin 对该项目做 **投资者准入**，必要时 Mint mUSDC。  
4. 投资人：Approve → **认购**；可再试赎回 / 领收益。  
5. 验收隔离：对项目 A `setNAV` / 认购，项目 B 份额余额与金库资金不变。

---

## Sepolia 复现

逐步说明、验证链接与 §4.4 报告稿：[docs/Sepolia部署教程.md](./docs/Sepolia部署教程.md)、[docs/作业交付材料.md](./docs/作业交付材料.md) §4.4。

```bash
npm run deploy:sepolia
# 按控制台打印验证 MockUSDC、ProjectRegistry、各 Share/Vault
# 前端 VITE_CHAIN_ID=11155111，填入 USDC + Registry 地址
```

---

## 核心合约

| 合约 | 职责 |
|------|------|
| `MockUSDC` | 测试稳定币（6 decimals），全市场共用 |
| `RWAShare` | 许可型份额 ERC-20（每项目一套） |
| `RWAVault` | 申购 / 赎回 / setNAV / 暂停 / 派息（每项目一套） |
| `ProjectRegistry` | 多公司项目目录：register / list / get / setListed |

文案对照（仅展示，合约函数名不变）：课堂演示系统 → RWA 资产市场；白名单 → 投资者准入；存入 USDC → 认购资产项目；销毁份额 → 赎回投资；setNAV → 更新项目份额净值；计息领息 → 分配 / 领取项目收益。

---

## 技术栈

- **合约**：Solidity 0.8.24 + Hardhat + OpenZeppelin 5.x  
- **前端**：React + Vite + wagmi + viem  
- **网络**：Hardhat 本地（31337）/ Sepolia（11155111）  
- **安全**：Hardhat 单测、Slither、Echidna（见 `docs/`）
