# 阶段 06 · 测试与安全：单元测试、Slither、Echidna、威胁模型

> 对应计划第 8 节、作业 **R4**、第 4 周前半。
> 本文按四部分组织：**1. 实现目标 → 2. 实现方法 → 3. 手动实践 → 4. 重点关注和学习**。
> 这是作业里最「像硬性清单」的一块：缺截图、缺模糊测试、缺 3–5 条威胁，都会直接扣分。
> 也是你们以后做「智能合约漏洞检测」的预习课。

---

## 1. 该阶段实现目标

一句话：

> **用三种 complementary 的手段证明合约行为：人写的单元测试、静态扫描 Slither、随机乱调函数的 Echidna；再用 5 条威胁把「我们怕什么、代码怎么防」写进报告。**

### 1.1 范围

| 在范围内 | 不在本阶段 |
|---|---|
| Hardhat 测试补全主路径与失败路径 | 主网审计招标 |
| Slither 跑全合约 + 截图 + 误报说明 | 修复每一个 Informational |
| Echidna 不变量至少 2 条 | 形式化验证 Coq |
| 威胁模型 5 条 + 缓解 | 真实赏金猎人流程 |
| 对照官方安全清单打勾 | 完整 ERC-3643 审计 |

### 1.2 交付线（DoD）

| # | 交付线 | 验收 |
|---|---|---|
| 1 | `npm test` 覆盖白名单、授权、申购赎回、暂停、（若有）派息 | 全绿 |
| 2 | Slither 报告/截图进入 `docs/` 或作业附件 | High/Medium 有处理 |
| 3 | Echidna 对不变量跑一段时间无违反 | 命令和配置写入 log |
| 4 | 报告列出 5 项威胁与缓解 | 见 2.4 |
| 5 | 开发对照 [智能合约安全指南教程](https://ethereum.org/zh/developers/tutorials/smart-contract-security-guidelines/) | 清单可贴附录 |

---

## 2. 实现方法

### 2.1 三种工具各管一层

```mermaid
flowchart TB
  Unit[Hardhat单元测试] -->|你想到的例子| Known[已知场景]
  Slither[静态分析] -->|不运行代码] Pattern[常见漏洞模式]
  Echidna[模糊测试] -->|随机调用] Invariant[不该被打破的定律]
```

- **单元测试**：你当老师出题，「未白名单不能存」。漏想的路径测不到。
- **Slither**：像改作业的语法/安全扫描仪，重入、未使用返回值、危险的 `tx.origin` 等。
- **Echidna**：随机用户乱按按钮一万次，看「非白名单余额永远为 0」会不会被打破。

作业要求 1+2 都要，缺一不可。

教程：

- [How to mock Solidity contracts for testing](https://ethereum.org/zh/developers/tutorials/how-to-mock-solidity-contracts-for-testing/)
- [Guide to smart contract security tools](https://ethereum.org/zh/developers/tutorials/guide-to-smart-contract-security-tools/)
- [How to use Slither](https://ethereum.org/zh/developers/tutorials/how-to-use-slither-to-find-smart-contract-bugs/)
- [How to use Echidna](https://ethereum.org/zh/developers/tutorials/how-to-use-echidna-to-test-smart-contracts/)

### 2.2 建议的不变量（Echidna）

用必须永远为真的性质，而不是「某次 deposit 返回 true」：

1. **准入**：`!whitelist[x] => share.balanceOf(x) == 0`（对外部账户；注意合约自己、零地址按你规则排除）
2. **偿付**：`usdc.balanceOf(vault) >= share.totalSupply() * nav / 1e6 + sumClaimable`（按 nav 计价本金 + 未领利息；nav=1e6 时退化为原 1:1 形式）
3. （可选）暂停时 `deposit` 总是 revert

Echidna 需要一个「测试合约」暴露这些 `echidna_` 函数，并配置能调用哪些入口。Windows 上安装可能比 Hardhat 更折腾，预留时间；可在 WSL 跑。

### 2.3 Slither 怎么用在报告里

老师要的是**证据**，不是「我们很安全」四个字。

建议固定格式：

- 命令：`slither .` 或 `slither contracts/ --solc-remaps @openzeppelin/=...`
- 截图：High / Medium 列表
- 表格：每个发现 = 真问题已修 / 误报原因（例如「Admin 中心化是产品设计」）

不要把 Informational 堆 20 页。突出 High/Medium。

### 2.4 五条威胁（计划已定，报告就写这些）

| # | 威胁 | 本项目里可能怎么发生 | 缓解 |
|---|------|----------------------|------|
| 1 | 重入 | `claimYield` / `redeem` 先转账再改记账 | `ReentrancyGuard` + 先改状态再转账 |
| 2 | 访问控制 | 任意人 mint 份额、任意人 pause、任意人改白名单 | AccessControl；测试反向用例 |
| 3 | 授权问题 | 无限 approve、`transferFrom` 失败未检查 | 演示用精确额度；`SafeERC20` |
| 4 | 暂停与中心化 | Admin 作恶暂停勒索、或被盗私钥 | 披露信任假设；多签可作为「将来工作」；作业用单 Admin |
| 5 | 净值喂价 / 抢先交易 | **无 Chainlink**；Admin `setNAV` 可被恶意抬价/压价；发息若有二级市场则有抢跑 | 报告写明中心化喂价信任假设；非 Admin 不能 setNAV 的测试；不开放公开订单簿 |

作业举例里的「整数问题」：0.8.x 默认溢出回滚，仍要小心除零（`totalSupply==0` 时发息）。

### 2.5 和「下个漏洞检测项目」怎么接

本阶段结束你会拥有：

- 一套带权限和资金会计的靶场合约
- 单元测试当回归
- Slither/Echidna 基线报告

下一项目可以是：写检测器专门找「transfer 未挂钩 accrue」「minter 角色过宽」，用本仓库当数据集。方向不冲突。

---

## 3. 手动实践

### 实验 1 · 把「攻击者故事」写成测试

每条威胁至少一条测试，例如：

- 攻击者合约在收款时重入 `redeem`（应用 mock 恶意代币或 `claim` 回调；USDC 是 ERC20 不一定有 hook，可用「先写会失败的恶意 Share」或文档说明 ERC20 重入面较小但仍给 Vault 加 guard）
- 随机地址调 `pause` 失败
- 随机地址调 `mint` 失败

### 实验 2 · 先跑 Slither 再改代码

对未完成合约跑一次，看报告长什么样。修完再跑第二次，报告里放「修复前后」更像认真作业。

### 实验 3 · Echidna 最小不变量

哪怕先只测 `true` 的 hello，确认工具链安装成功，再换真正不变量。工具链本身从 0 很耗时，不要放到交作业前一天。

### 实验 4 · 对照清单自检

打印 ethereum.org / OZ 安全清单，对每个合约函数问：谁能调？有没有事件？失败是否 revert？有没有无界循环？

---

## 4. 重点关注和学习

### 4.1 revert 是功能，不是丢人

许可代币的「转给路人失败」就是安全成功。测试要 `expectRevert`，不要只测 happy path。

### 4.2 静态分析不是定理证明

Slither 会漏、会误报。所以作业才同时要 Echidna 和人工威胁列表。写报告时展示你懂这个局限。

### 4.3 整数与精度

派息尘埃、`totalSupply == 0`、decimals 混用（6 vs 18）是从 0 最常见的「看起来像漏洞」的 bug。

### 4.4 延伸（下个项目再深挖）

- Manticore 符号执行（ethereum.org 高级教程有）
- 重入经典：The DAO；读是为了讲威胁，不必在本作业复现攻击链

---

## 5. 决策与产物小结

**决策**：五条威胁清单固定（第 5 条覆盖 **Admin setNAV 中心化喂价**，非外部预言机）；Echidna 不变量与 nav 计价 + 派息会计对齐。

**产物**：

| 产物 | 路径 |
|------|------|
| Hardhat 测试 | `test/RWAVault.test.js`、`test/RWAShare.test.js`、`test/MockUSDC.test.js` |
| Slither 说明 | [`docs/Slither扫描说明.md`](../../docs/Slither扫描说明.md)、[`docs/slither-raw.json`](../../docs/slither-raw.json) |
| Echidna harness | [`contracts/echidna/EchidnaRWAVault.sol`](../../contracts/echidna/EchidnaRWAVault.sol)、根目录 [`echidna.yaml`](../../echidna.yaml) |
| 威胁表 | [`docs/威胁模型与缓解.md`](../../docs/威胁模型与缓解.md) |

**下一阶段**：Sepolia 部署与验证、README 链接、升级/暂停说明——此时再部署，避免测网反复花钱（水龙头 ETH）修漏洞。

---

## 6. 本机实跑记录（阶段 06 完成时）

### 6.1 Hardhat：`npm test`

```bash
npm test
```

**结果：全绿（29 passing）。** 覆盖：

- 白名单：未入白 `deposit` / `claimYield` / `transfer` 失败；入白后成功
- 授权：未 `approve` 时 `deposit` 失败；`SafeERC20`
- 按 nav 申购/赎回：`nav=1e6` 与 `setNAV(2e6)` 后数量变化；先申购再抬价赎回
- `setNAV`：Admin 成功；**非 Admin 失败**；`setNAV(0)` → `ZeroNav`
- 暂停：pause 后 deposit/redeem/setNAV/distribute/claim 失败；unpause 恢复；非 Admin 不能 pause
- 派息：两人均分、`totalSupply==0` 不能发息、转让前结息、改 nav 与利息分轨、偿付不等式

### 6.2 Slither（已跑通）

```bash
pip install slither-analyzer
solc-select install 0.8.24
solc-select use 0.8.24

slither contracts/ --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/" --filter-paths "node_modules|echidna" --exclude-dependencies --json docs/slither-raw.json
```

| 级别 | 条数 | 处理 |
|------|------|------|
| High | 0 | — |
| Medium | 2（`incorrect-equality`） | **误报**：`amount == 0` / `bal == 0` 为业务判断 |
| Low `missing-zero-check`（`setVault`） | 1 → 0 | **已修** `require(vault_ != address(0))` |

Admin 可 `pause` / `setNAV`：**产品设计**，详见威胁表；Slither 未将其标为 High/Medium。说明文档：[`docs/Slither扫描说明.md`](../../docs/Slither扫描说明.md)。

### 6.3 Echidna（已跑通）

**本机环境说明：**

- WSL2 磁盘挂载失败（`ext4.vhdx` / `ERROR_FILE_NOT_FOUND`），**不能**用 WSL 跑。
- 改用官方 Windows 二进制：`echidna-2.3.3-x86_64-windows.zip` → 解压到 `tools/echidna/echidna.exe`（目录已 `.gitignore`，勿提交）。
- 需本机 `solc 0.8.24` 在 PATH（`solc-select use 0.8.24`）。

**配置文件：** 仓库根目录 [`echidna.yaml`](../../echidna.yaml)（`testMode: property`，`testLimit: 50000`）。

**Harness：** [`contracts/echidna/EchidnaRWAVault.sol`](../../contracts/echidna/EchidnaRWAVault.sol)

不变量：

1. `echidna_outsider_zero_shares`：永不入白的 `OUTSIDER` 份额余额恒为 0  
2. `echidna_vault_solvency`：`USDC(vault) >= totalSupply * nav / 1e6 + unclaimedYieldAccounting()`  
   - harness 在抬高 `nav` 时会自动向金库补足差额（否则 Admin 抬价不注资会故意打破偿付，属威胁 5，不是 fuzz 会计错误）

**可复制运行命令（PowerShell，仓库根目录）：**

```powershell
# 若尚未下载二进制：从 GitHub release 取 echidna-2.3.3-x86_64-windows.zip 解压到 tools\echidna\
solc-select use 0.8.24
.\tools\echidna\echidna.exe .\contracts\echidna\EchidnaRWAVault.sol --contract EchidnaRWAVault --config echidna.yaml
```

**本次实跑结果：**

```
echidna_outsider_zero_shares: passing
echidna_vault_solvency: passing
Total calls: 50074
```

终端摘要另存：[`docs/echidna-run.txt`](../../docs/echidna-run.txt)。

### 6.4 威胁表

已写入 [`docs/威胁模型与缓解.md`](../../docs/威胁模型与缓解.md)（固定 5 条 + Solidity 0.8 溢出回滚、`totalSupply==0` 不能发息、`newNav > 0`）。
