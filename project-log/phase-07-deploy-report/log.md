# 阶段 07 · 部署、验证、运维说明与作业报告

> 对应计划第 9、11 节，作业 **R5** 以及 R1/R2 文档收口。第 4 周后半。
> 本文按四部分组织：**1. 实现目标 → 2. 实现方法 → 3. 手动实践 → 4. 重点关注和学习**。

---

## 1. 该阶段实现目标

一句话：

> **把同一套脚本打到 Sepolia，在 Etherscan 上验证开源，README 放链接；写清「不可升级 + 用 pause 止损」；把流程图和问题陈述装进报告，让老师按演示清单点一遍。**

### 1.1 范围

| 在范围内 | 不在本阶段 |
|---|---|
| `SEPOLIA_RPC_URL` + 部署账户私钥（本地 env） | 主网、真实 USDC |
| Etherscan 验证三个合约 | 自动监控 Grafana |
| README：地址、验证链接、如何复现 | 法律意见书 |
| `docs/运维与升级说明.md` | 代理合约升级实操 |
| 报告：R1 陈述、R2 时序图、演示步骤 | 新功能开发 |

### 1.2 交付线（DoD）

| # | 交付线 | 验收 |
|---|---|---|
| 1 | 三合约在 Sepolia 有地址 | 区块浏览器能打开 |
| 2 | 源码验证通过（扁平或 standard JSON） | 浏览器显示绿色勾、能读函数 |
| 3 | `scripts/deploy.js` 换网络可复现 | 文档中命令可复制 |
| 4 | 暂停与不可变理由成文 | 符合作业「即使不可变也要写清」 |
| 5 | 2 分钟演示在测试网或本地可走通 | 组员排练过 |

---

## 2. 实现方法

### 2.1 为什么必须上 Sepolia

本地链关机即消失，老师无法点你的 localhost。测试网交易公开、可验证，又没有主网资金风险。这就是 R5。

```mermaid
flowchart LR
  Code[仓库源码] --> Script[deploy脚本]
  Script --> Sepolia[Sepolia节点RPC]
  Sepolia --> Address[合约地址]
  Address --> Verify[hardhat_verify]
  Verify --> Explorer[Etherscan开源展示]
  Explorer --> README[作业README链接]
```

### 2.2 部署顺序（与阶段 03 相同，网络不同）

1. 准备 Sepolia ETH（水龙头，额度小，别循环部署）
2. `.env`：`SEPOLIA_RPC_URL`、`PRIVATE_KEY`、`ETHERSCAN_API_KEY`（均 gitignore）
3. `npx hardhat run scripts/deploy.js --network sepolia`
4. `npx hardhat verify --network sepolia <地址> <构造参数...>` 三个都要做
5. seed：给演示账户 mint、加白名单（可用第二个脚本，记录交易哈希）
6. 前端 `VITE_CHAIN_ID=11155111`（Sepolia）+ 新地址

构造参数必须与部署时**完全一致**，否则验证失败。把 deploy 日志保存下来。

### 2.3 暂停 / 升级怎么写才像 R5

推荐作业采用的诚实表述：

**升级**：不使用 Transparent/UUPS Proxy。原因：从 0 团队减少代理管理权、存储槽等攻击面；课程周期短。变更方式 = 暂停旧池、部署新合约、用户到新池重新申购（教学可接受；生产 RWA 通常要更严肃的迁移）。

**暂停**：`Pausable` 由 Admin 触发，冻结 `deposit`/`redeem`/`distribute`/`claim`（与实现保持一致）。用于：发现漏洞、演示应急。风险：Admin 密钥被盗可冻结用户资金——写进威胁模型第 4 条。

**运维**：无 24h 值班。监控 = 看 Etherscan 最新交易。足够作业。

### 2.4 报告结构建议（对齐 R1–R5）

1. 问题陈述（阶段 00 的 200 字扩成 1 页）：用户、痛点、为何不是数据库  
2. 范围：标准版功能表（**含必做 setNAV**）+ 明确不做（Chainlink、真 KYC、二级市场等）  
3. 架构：链上三合约、链下 UI；贴阶段 00/03 的图  
4. 角色与时序：加白名单 → **setNAV** → 申购 → 领息 → 赎回  
5. 实现要点：`_update` 白名单、Vault 按 nav 计价、`setNAV`、rewardIndex、事件与角色；写明 setNAV ≠ 去中心预言机  
6. 测试：单元测试列表、Slither 截图、Echidna 不变量  
7. 威胁 5 条  
8. 部署：地址、验证链接、脚本、暂停与不可变  
9. 演示步骤  
10. 后续：漏洞检测项目如何用本仓库当靶场  

流程图手绘拍照也可以，作业允许。

### 2.5 README 最少要素

- 项目一句话 + 不是真实证券
- 安装与本地命令（compile/test/node/deploy/frontend）
- Sepolia 地址表 + 三个 verify 链接
- 演示账户说明（不要提交私钥）
- 指向 `project-log/` 给「想从 0 学的人」

---

## 3. 手动实践

### 实验 1 · 先在本地演「验证会用到的构造参数」

把 deploy 脚本 `console.log` 出的参数抄下来。到 Sepolia 再 verify，减少盲试耗 ETH。

### 实验 2 · 水龙头与 Gas

用单独开发账户。余额不够时交易卡 pending。学会在 Etherscan 看 Gas 与失败原因（`revert` 选择器）。

### 实验 3 · 验证成功后点「Read/Write Contract」

不通过你们前端，直接在 Etherscan 读 `balanceOf`、尝试用未授权账户写 `pause`（应失败）。这能向老师证明：**权限在链上。**

### 实验 4 · 全流程彩排计时

用秒表走 2 分钟脚本。超时就砍页面解释，保留：白名单、申购、非法转账失败、赎回（有派息再加 claim）。

---

## 4. 重点关注和学习

### 4.1 私钥

部署私钥 = 合约 Admin。泄漏 = 别人 mint / 暂停 / 改名单。只用测试网密钥，金额为 0 的专门账户。

### 4.2 验证失败常见原因

- 编译器版本与 `hardhat.config` 不一致  
- optimizer 开关/次数不一致  
- 构造参数编码错误（地址大小写无所谓，但值必须对）  
- 一次部署多个合约却 verify 错地址  

### 4.3 「可复现」的含义

助教 clone 后：装依赖 → 配自己的 env → 能部署自己的一份。不是必须用你已经部署的地址开发，但你必须提供**你的**已验证实例方便他们点开看。

### 4.4 延伸

- 多签 Admin（Gnosis Safe）作为完整版运维
- CI 里对 Sepolia 做 fork 测试（超出作业）

---

## 5. 决策与产物小结

**决策**：Sepolia + 三合约均验证；不可升级 + pause；报告按评分项排版而不是按文件列表排版。

**产物**：测试网实例、README 链接、`docs/RWA-技术设计.md`（可由本 project-log 压缩而成）、`docs/运维与升级说明.md`、`docs/威胁模型与缓解.md`、演示清单。

**全部阶段结束后**：你应能从 0 讲完「许可份额小金库」的状态机、代码落点、如何证明它不容易被随便转走或随便铸造——这就是本计划和作业的交汇点。

---

## 6. 本阶段落地记录（脚本 / 文档已就绪，链上待本机执行）

已完成（无编造地址）：

- `hardhat.config.js`：`dotenv` + `sepolia` 读 `SEPOLIA_RPC_URL` / `PRIVATE_KEY` + `etherscan.apiKey`
- `scripts/deploy.js`：三合约 + 授角色；Sepolia 下打印 verify 命令
- `.env.example`、README 占位地址表、本地/Sepolia 复现命令、范围表（setNAV 必做 / Chainlink 不做）
- `docs/运维与升级说明.md`、`docs/演示脚本.md`

待你本机填 env 后执行：

```bash
npm run deploy:sepolia
# 再按控制台打印的三条 hardhat verify 命令验证
# 把真实地址贴回 README 表格
```
