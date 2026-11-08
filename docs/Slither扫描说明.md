# Slither 扫描说明

> 工具：`slither-analyzer 0.11.6` + `solc 0.8.24`  
> 原始 JSON：[`slither-raw.json`](./slither-raw.json)  
> 操作记录：[phase-06-security/log.md](../project-log/phase-06-security/log.md)

---

## 可复制命令

在仓库根目录（已 `npm install`，且本机有 Python/`pip`）：

```bash
# 一次性依赖（Windows PowerShell 亦可）
pip install slither-analyzer
solc-select install 0.8.24
solc-select use 0.8.24

# 扫描业务合约（排除 OZ 依赖与 Echidna harness）
slither contracts/ --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/" --filter-paths "node_modules|echidna" --exclude-dependencies

# 需要机器可读结果时追加：
#   --json docs/slither-raw.json
```

也可用 Hardhat 编译产物（本仓库两种框架并存时）：

```bash
slither . --compile-force-framework hardhat --filter-paths "node_modules|echidna" --exclude-dependencies
```

本次作业正文采用 **solc + remaps** 的第一条命令；退出码非 0 表示仍有告警（Slither 惯例），不等于编译失败。

---

## High / Medium 逐条

本次扫描：**无 High**。Medium 与已处理项如下。

| 级别 | Detector | 位置 | 结论 |
|------|----------|------|------|
| Medium | `incorrect-equality` | `RWAVault.claimYield`：`amount == 0` | **误报**。此处判断「无可领利息」并 `revert ZeroAmount`，不是价格/余额竞态下的危险相等；整数尘埃用 `== 0` 正是预期。 |
| Medium | `incorrect-equality` | `RWAVault.pendingYield`：`bal == 0 \|\| delta == 0` | **误报**。视图函数短路：无余额或无指数增量时应得 0，避免无意义乘法。 |
| Low（已修） | `missing-zero-check` | `RWAShare.setVault` | **已修**：`require(vault_ != address(0), "zero vault")`。修复后再扫，该条消失。 |

### 关于「Admin 能 pause / 能 setNAV」

Slither **未**将 `pause` / `setNAV` 标为 High/Medium 漏洞（`AccessControl` 限制调用方）。  
作业仍须在报告中写清：

- 管理员能暂停、能 `setNAV` **属于产品设计**（许可金库 + 中心化净值喂价），不是要「修掉」的误报漏洞；
- 信任假设落在 Admin 密钥；**不接 Chainlink**；
- 对应威胁见 [`威胁模型与缓解.md`](./威胁模型与缓解.md) 第 4、5 条。

Informational / 命名类告警不展开堆砌。

---

## 本次运行摘要

```
contracts/ analyzed (...), 2 result(s) found
- Medium incorrect-equality × 2（误报，见上表）
- High: 0
```

扫描时间：阶段 06 执行；以仓库内 `docs/slither-raw.json` 为准。
