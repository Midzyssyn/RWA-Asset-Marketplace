# Sepolia 测试网部署教程（成员 1 操作说明）

> 对应作业 **R5 / 第 5 章 §4.4 Testnet Deployment and Verification**。  
> 私钥只放本机根目录 `.env`，**不要**贴到聊天、截图或 Git。

---

## 0. 这次重新部署在干什么？

按时间顺序，本机实际做了这些事：

1. **改合约逻辑（方案 A）**  
   `RWAShare.removeFromWhitelist`：有份额余额时禁止移出白名单（`NonZeroShareBalance`），保证「非白名单余额恒为 0」。
2. **本地单测**  
   `npm test -- --grep RWAShare` → 含「有持仓不能移出；清仓后可移出」。
3. **准备环境变量**（已在 `.env`，gitignore）  
   `SEPOLIA_RPC_URL`、`PRIVATE_KEY`、`ETHERSCAN_API_KEY`；账户需有 Sepolia ETH 付 Gas。
4. **部署到 Sepolia**  
   `npm run deploy:sepolia` → 脚本部署 MockUSDC、ProjectRegistry，以及 3 套 Share+Vault 并 `registerProject`。
5. **Etherscan 开源验证**  
   按控制台打印的 `npx hardhat verify --network sepolia ...` 逐个验证（8 个合约）。
6. **回写地址**  
   更新 `frontend/.env`、`README.md`、本教程与 [作业交付材料.md](./作业交付材料.md) §6 / §4.4。

**为何要重新部署：** 合约**不可升级**（无 Proxy）。旧 Sepolia 实例仍是「有仓可踢出」的旧逻辑；新逻辑必须**新部署**一套地址，前端改连新地址。

---

## 1. 部署前准备（一次性）

| 你需要的 | 作用 | 怎么拿 |
|----------|------|--------|
| `PRIVATE_KEY` | 签名部署交易 | MetaMask 导出**测试网专用**账户私钥 |
| `SEPOLIA_RPC_URL` | 连测试网节点 | Alchemy / Infura / [PublicNode](https://ethereum-sepolia-rpc.publicnode.com) 等 |
| Sepolia ETH | 付 Gas | 水龙头领取（建议 ≥ 0.1） |
| `ETHERSCAN_API_KEY` | `hardhat verify` | [etherscan.io/apikey](https://etherscan.io/apikey) |

```powershell
# 仓库根目录
Copy-Item .env.example .env   # 若还没有 .env
notepad .env                  # 填入上表三项（勿提交）
npm install
```

---

## 2. 部署命令（一步）

```powershell
npm run deploy:sepolia
```

等价于：`hardhat run scripts/deploy.js --network sepolia`。

脚本会依次：

1. 用 `.env` 里的私钥连 Sepolia；
2. 部署 `MockUSDC(admin)`；
3. 部署 `ProjectRegistry(admin)`；
4. 对每个示例项目：部署 `RWAShare` → `RWAVault` → 授予 mint/burn → `setVault` → `registerProject`；
5. 打印地址摘要、前端 `VITE_*` 三行、以及后续 verify 命令。

本次（2026-11-08）部署账户：`0x19de368943D563dF5A7Ee78bB1fEdD7901899d92`。

---

## 3. 开源验证

部署成功后，用控制台打印的命令（需已配置 `ETHERSCAN_API_KEY`）：

```powershell
npx hardhat verify --network sepolia <地址> [构造参数...]
```

验证通过后，Etherscan 合约页可点 **Contract → Code** 查看源码。  
若提示 *already been verified*，表示字节码与已验证合约一致，同样算验证成功。

---

## 4. 前端切到新地址

把部署打印的三行写入 `frontend/.env`（或照 README / 下方地址表）：

```env
VITE_MOCK_USDC_ADDRESS=0xe943969d85cE2427a04C60440a912e1529d2350C
VITE_PROJECT_REGISTRY_ADDRESS=0x1A21801403140A9170c50D8cbdB1aeca31a11918
VITE_CHAIN_ID=11155111
```

MetaMask 切到 **Sepolia**，再：

```powershell
npm run dev:frontend
```

（可选）种子：把地址写入环境变量后  
`npx hardhat run scripts/seed-demo.js --network sepolia`  
（投资者准入 + mint MockUSDC；本次交付以部署+验证为主，seed 可按演示需要另跑。）

---

## 5. 本次 Sepolia 地址与验证链接（现行）

| 合约 | 地址 | 创建交易 | 验证 |
|------|------|----------|------|
| MockUSDC | `0xe943969d85cE2427a04C60440a912e1529d2350C` | [tx](https://sepolia.etherscan.io/tx/0xdacb22032477dbd7126ddf6bdc6e666c4b6cd3d4b862447d3118735a499493e5) | [code](https://sepolia.etherscan.io/address/0xe943969d85cE2427a04C60440a912e1529d2350C#code) |
| ProjectRegistry | `0x1A21801403140A9170c50D8cbdB1aeca31a11918` | [tx](https://sepolia.etherscan.io/tx/0xb3d8a344a111f40b5bc5e549614897c761344fa7ae462cfd72ff737e32efe8d5) | [code](https://sepolia.etherscan.io/address/0x1A21801403140A9170c50D8cbdB1aeca31a11918#code) |
| #0 Share 东海光伏 | `0x1c10ed637763551a0d13A6BdA42765a20E31b534` | [tx](https://sepolia.etherscan.io/tx/0x69d7312afdc17d1af707dc95ded0d43b4b5d888314acb0d691b7f9bf2c4fff25) | [code](https://sepolia.etherscan.io/address/0x1c10ed637763551a0d13A6BdA42765a20E31b534#code) |
| #0 Vault | `0x6599413e12a6923A1600D57147f2858723DCAa8B` | [tx](https://sepolia.etherscan.io/tx/0x7ea34bcbe4fe04ab7457dfba349001030dcab68d02d3b14d7008b6735c9395a5) | [code](https://sepolia.etherscan.io/address/0x6599413e12a6923A1600D57147f2858723DCAa8B#code) |
| #1 Share 江城仓储 | `0x4D77c3B84Cdb36b65700C749034eF022d3A589cE` | [tx](https://sepolia.etherscan.io/tx/0xeea7c996775d8e012a00f064d583a73589008ccb78d7974950175c82d0ad8b24) | [code](https://sepolia.etherscan.io/address/0x4D77c3B84Cdb36b65700C749034eF022d3A589cE#code) |
| #1 Vault | `0xD15Aa4C0Cb65c9b79fe5640e1C6BD02cD265fDD3` | [tx](https://sepolia.etherscan.io/tx/0xb9548603f730cefb9f6bc4e57c20354db74aaa1a4c0374c097bc814388440f43) | [code](https://sepolia.etherscan.io/address/0xD15Aa4C0Cb65c9b79fe5640e1C6BD02cD265fDD3#code) |
| #2 Share 滨海租金 | `0x72ddD60EefcbC397fbA6b8f7645ef946848a93c7` | [tx](https://sepolia.etherscan.io/tx/0x228b7db97954e54e735e2cdcefe1e06ed54dbf38ae3bf4857052fc0ee9360f20) | [code](https://sepolia.etherscan.io/address/0x72ddD60EefcbC397fbA6b8f7645ef946848a93c7#code) |
| #2 Vault | `0xcF2bEB331F7f6e47be13843a1E773EDB8eA73830` | [tx](https://sepolia.etherscan.io/tx/0xad78356fd3e31ce96c2b3c04514e987f85737efed37ebd843c705e470b706df5) | [code](https://sepolia.etherscan.io/address/0xcF2bEB331F7f6e47be13843a1E773EDB8eA73830#code) |

网络：`Sepolia`，`chainId = 11155111`。  
Admin / NAV_MANAGER（本次）：`0x19de368943D563dF5A7Ee78bB1fEdD7901899d92`。

> 更早一次 Sepolia 部署（无清仓校验的旧 Share）已弃用，请勿再写入报告主表。

---

## 6. 暂停与升级理由（报告可直接用）

详见 [运维与升级说明.md](./运维与升级说明.md)。摘要：

| 问题 | 做法 | 理由 |
|------|------|------|
| 运行期出事（漏洞、误操作） | 项目方对该 Vault 调 `pause()` | 冻结本项目认购/赎回/改净值/派息/领息；**不是** Registry `setListed(false)`（下架只改目录） |
| 需要改业务逻辑 | **不升级旧合约**；修代码 → 测通 → **重新部署** → 前端换地址 | 教学项目**不用** Transparent/UUPS Proxy，降低代理攻击面与复杂度 |
| 旧池怎么办 | 保持 pause；教学不做自动资金迁移 | 演示级可接受；生产需多签/治理/迁移方案（范围外） |

**诚实边界：** 「不可升级」≠ 无中心化风险；Admin 仍可 pause、改白名单；`setNAV` 为中心化喂价（非 Chainlink）。

---

## 7. 未完成 / 范围外（如实说明）

| 项 | 状态 |
|----|------|
| Sepolia 部署 + Etherscan 验证（现行 8 合约） | **已完成** |
| 前端 env / README 地址同步 | **已完成** |
| 本地 Hardhat 部署与单测 / Slither / Echidna | **已完成**（见作业交付材料其它节） |
| Sepolia 上 `seed-demo`（批量准入 + mint） | **按需**；本次以部署验证为主，演示前可另跑 |
| 主网、真 USDC、Proxy 升级、多签 Admin | **不做**（需求范围外） |
| 旧 Sepolia 地址迁移用户资金 | **不做**（教学重新部署） |

---

## 8. 给成员 5 的摘录位置

完整填空稿见 [作业交付材料.md](./作业交付材料.md) **§4.4**；地址表亦见 README「部署地址」。
