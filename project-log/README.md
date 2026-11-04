# 项目建设日志（RWA 标准版）

本目录按阶段记录：**这个作业项目要做什么、为什么这么做、小白先学什么、动手怎么练。**

**总数据流与原理（正式设计文档）：** 先读 [docs/RWA-技术设计.md](../docs/RWA-技术设计.md)。本目录是从 0 的分阶段讲解；技术设计文档是合并后的一版总览。

仓库主路径已切到 **RWA 标准版（MVP+）**：阶段 01 工具链已通，阶段 02 起主合约为 `MockUSDC` / `RWAShare`。各阶段 `log.md` 的定位是：

- **讲清楚计划**（目标、范围、原理、数据流）
- **从 0 补概念**（钱包、合约、代币、Vault、安全）
- **给出可动手的练习**（ethereum.org 教程 + 本仓库将来要跑的命令）
- **留下验收标准**（做到什么才算这一阶段结束）

等对应阶段真正落地后，再在同一份 `log.md` 里补「实际完成了什么、踩了什么坑、产物在哪」——和参考项目 `post-training-slot-extractor` 的 project-log 用法一致。

## 日志应记录什么

每一阶段文件夹里的 `log.md` 尽量包含：

1. **阶段目标与交付线**
2. **实现方法 / 原理**（小白能看懂的版本）
3. **手动实践**（可亲手做的实验）
4. **重点关注和学习**
5. **范围内 / 范围外**，以及和作业评分项 R1–R5 的关系

## 阶段总览

| 阶段 | 目录 | 你要搞懂的一句话 |
|------|------|------------------|
| 00 | [phase-00-concepts](./phase-00-concepts/log.md) | 区块链、合约、RWA、本项目在模拟什么 |
| 01 | [phase-01-scaffold](./phase-01-scaffold/log.md) | 环境跑起来，能部署一个 Hello World |
| 02 | [phase-02-permissioned-token](./phase-02-permissioned-token/log.md) | 假 USDC + 只能白名单持有的份额币 |
| 03 | [phase-03-vault](./phase-03-vault/log.md) | 申购、赎回、暂停、**Admin setNAV（必做）** |
| 04 | [phase-04-yield](./phase-04-yield/log.md) | 按份额领息（分红指数，禁止 for 循环发钱） |
| 05 | [phase-05-frontend](./phase-05-frontend/log.md) | 网页连钱包，点按钮调合约（含设置/展示 NAV） |
| 06 | [phase-06-security](./phase-06-security/log.md) | 测试 + Slither + Echidna + 威胁模型（含 NAV 喂价） |
| 07 | [phase-07-deploy-report](./phase-07-deploy-report/log.md) | Sepolia 部署、验证、作业报告 |

建议阅读顺序就是 00 → 07。零基础不要从合约文件开始翻，先读阶段 00。

**范围提醒：** Admin `setNAV`（中心化净值）是标准版**必做**；Chainlink 等外部预言机**不做**。细节见 [docs/RWA-技术设计.md §6.6](../docs/RWA-技术设计.md)。

## 和四周工期的对应

| 周 | 建议完成的阶段 |
|----|----------------|
| 第 1 周 | 00 + 01 + 02 |
| 第 2 周 | 03（含 setNAV） |
| 第 3 周 | 04 + 05 |
| 第 4 周 | 06 + 07 |

若第 3 周派息做不动：阶段 04 可降级为「设计写进报告、代码未合并」，优先保证 **03（含 setNAV）+ 05 + 06 + 07**。`setNAV` **不可**降级。
