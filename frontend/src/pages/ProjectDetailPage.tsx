import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { maxUint256 } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ChainGuard } from "../components/ChainGuard";
import { StatusBadges } from "../components/StatusBadges";
import { TxBanner } from "../components/TxBanner";
import { ABIS, CONTRACTS, contractsConfigured } from "../config/contracts";
import { useDemoRole } from "../demo/DemoRoleContext";
import { useProject } from "../hooks/useProjects";
import { useTx } from "../hooks/useTx";
import {
  estimateAssets,
  estimateShares,
  formatAmount,
  parseAmount,
} from "../lib/units";

type DepositAction = "idle" | "approve" | "deposit";

export function ProjectDetailPage() {
  const { id: idParam } = useParams();
  const projectId = Number.parseInt(idParam ?? "", 10);
  const idValid = Number.isFinite(projectId) && projectId >= 0;

  const { address, isConnected } = useAccount();
  const demo = useDemoRole();
  const { project, isLoading: projectLoading } = useProject(
    idValid ? projectId : null
  );
  const tx = useTx();

  const [depositInput, setDepositInput] = useState("100");
  const [redeemInput, setRedeemInput] = useState("");
  const [lastDepositAction, setLastDepositAction] =
    useState<DepositAction>("idle");

  const share = project?.share;
  const vault = project?.vault;
  const ready =
    isConnected &&
    !!address &&
    contractsConfigured() &&
    !!share &&
    !!vault;

  const { data: nav, refetch: refetchNav } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "nav",
    query: { enabled: !!vault },
  });

  const { data: paused } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "paused",
    query: { enabled: !!vault },
  });

  const { data: depositsOpen } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "depositsOpen",
    query: { enabled: !!vault },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: ABIS.mockUsdc,
    functionName: "allowance",
    args: address && vault ? [address, vault] : undefined,
    query: { enabled: ready },
  });

  const { data: usdcBal, refetch: refetchUsdc } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: ABIS.mockUsdc,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: ready },
  });

  const { data: shareBal, refetch: refetchShare } = useReadContract({
    address: share,
    abi: ABIS.rwaShare,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: ready },
  });

  const { data: pendingYield, refetch: refetchYield } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "pendingYield",
    args: address ? [address] : undefined,
    query: { enabled: ready },
  });

  const { data: whitelisted } = useReadContract({
    address: share,
    abi: ABIS.rwaShare,
    functionName: "whitelist",
    args: address ? [address] : undefined,
    query: { enabled: ready },
  });

  const refresh = () => {
    void refetchNav();
    void refetchAllowance();
    void refetchUsdc();
    void refetchShare();
    void refetchYield();
  };

  const depositAssets = useMemo(() => {
    try {
      return parseAmount(depositInput);
    } catch {
      return 0n;
    }
  }, [depositInput]);

  const redeemShares = useMemo(() => {
    try {
      return parseAmount(redeemInput);
    } catch {
      return 0n;
    }
  }, [redeemInput]);

  const estShares =
    nav !== undefined ? estimateShares(depositAssets, nav) : 0n;
  const estAssets =
    nav !== undefined ? estimateAssets(redeemShares, nav) : 0n;

  const needsApprove =
    depositAssets > 0n &&
    (allowance === undefined || allowance < depositAssets);

  const isDelisted =
    !!project && (!project.listed || depositsOpen === false);
  const isPaused = !!paused;
  const notAdmitted = whitelisted === false;

  const canSubscribe =
    !!project &&
    project.listed &&
    depositsOpen !== false &&
    !isPaused &&
    !!whitelisted;

  const onApprove = () => {
    if (!address || !vault) return;
    setLastDepositAction("approve");
    void tx.send(
      {
        address: CONTRACTS.mockUsdc,
        abi: ABIS.mockUsdc,
        functionName: "approve",
        args: [vault, maxUint256],
      },
      "Approve USDC",
      refresh
    );
  };

  const onDeposit = () => {
    if (!address || !vault || depositAssets === 0n) return;
    setLastDepositAction("deposit");
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "deposit",
        args: [depositAssets],
      },
      "认购资产项目",
      refresh
    );
  };

  const onRedeem = () => {
    if (!address || !vault || redeemShares === 0n) return;
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "redeem",
        args: [redeemShares],
      },
      "赎回投资",
      refresh
    );
  };

  const onClaim = () => {
    if (!address || !vault) return;
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "claimYield",
      },
      "领取项目收益",
      refresh
    );
  };

  if (!idValid) {
    return (
      <section className="page">
        <p className="notice warn">无效的项目编号。</p>
        <Link to="/">返回市场</Link>
      </section>
    );
  }

  const approvePhaseHint = (() => {
    if (lastDepositAction !== "approve") return null;
    if (tx.phase === "wallet" || tx.phase === "pending") {
      return (
        <p className="step-hint pending">Approve 进行中：等待钱包确认与上链…</p>
      );
    }
    if (tx.phase === "success") {
      return <p className="step-hint success">Approve 成功，可继续认购。</p>;
    }
    if (tx.phase === "error") {
      return <p className="step-hint error">Approve 失败：{tx.message}</p>;
    }
    return null;
  })();

  const depositPhaseHint = (() => {
    if (lastDepositAction !== "deposit") return null;
    if (tx.phase === "wallet" || tx.phase === "pending") {
      return (
        <p className="step-hint pending">认购进行中：等待钱包确认与上链…</p>
      );
    }
    if (tx.phase === "success") {
      return <p className="step-hint success">认购成功，份额已入账。</p>;
    }
    if (tx.phase === "error") {
      return <p className="step-hint error">认购失败：{tx.message}</p>;
    }
    return null;
  })();

  return (
    <section className="page detail-page">
      <p className="breadcrumb">
        <Link to="/">资产市场</Link> / 项目 #{projectId}
      </p>

      {projectLoading && <p className="muted">加载项目…</p>}

      {!projectLoading && !project && (
        <p className="notice warn">未找到该项目。</p>
      )}

      {project && (
        <header className="detail-hero">
          <div className="detail-hero-top">
            <span className="company-tag">{project.companyName}</span>
            <StatusBadges listed={project.listed} paused={paused} />
          </div>
          <h1>{project.name}</h1>
          <p className="lede">{project.description}</p>
        </header>
      )}

      {project && !demo.showInvestor && demo.role !== "all" && (
        <p className="notice">
          当前演示角色是「{demo.def.label}」：认购/赎回请先在顶部切到
          <strong>投资人</strong>；运维到 <Link to="/admin">Admin</Link>。
        </p>
      )}

      {/* 三种禁用提示互不混用 */}
      {project && notAdmitted && (
        <p className="notice notice-admit" role="status">
          <strong>未准入。</strong>
          当前地址未完成该项目投资者准入，认购 / 赎回 / 领收益会被合约拒绝。请联系项目方在
          Admin「投资者准入」中添加白名单——这与下架、暂停无关。
        </p>
      )}
      {project && isDelisted && (
        <p className="notice notice-delisted" role="status">
          <strong>已下架。</strong>
          市场目录不可见或链上已关闭新认购（depositsOpen=false）。已持有份额在柜台未暂停时可赎回与领息。下架 ≠
          暂停，不停柜台、不锁既有资金。
        </p>
      )}
      {project && isPaused && (
        <p className="notice notice-paused" role="status">
          <strong>柜台已暂停。</strong>
          本项目链上申购、赎回、改净值与领息均停止（Vault pause）。这不是下架——恢复柜台后即可继续操作。
        </p>
      )}

      <ChainGuard />
      <TxBanner
        phase={tx.phase}
        message={tx.message}
        hash={tx.hash}
        onDismiss={tx.reset}
      />

      {!isConnected && (
        <p className="notice">请先连接钱包后再认购 / 赎回。净值预估与状态提示可先浏览。</p>
      )}

      {project && vault && share && (
        <>
          <div className="stat-grid compact">
            <div className="stat">
              <span className="stat-label">当前净值</span>
              <span className="stat-value">
                {nav === undefined ? "—" : formatAmount(nav)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">市场可见性</span>
              <span className="stat-value">
                {project.listed ? "已上架" : "已下架"}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">柜台状态</span>
              <span className="stat-value">
                {paused ? "柜台暂停" : "柜台开放"}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">USDC / 份额</span>
              <span className="stat-value">
                {formatAmount(usdcBal)} / {formatAmount(shareBal)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">投资者准入</span>
              <span className="stat-value">
                {!isConnected
                  ? "—"
                  : whitelisted
                    ? "已准入"
                    : "未准入"}
              </span>
            </div>
          </div>

          {/* 未连接时展示三种禁用提示样式，便于对照（真实禁用仍按链上状态） */}
          {!isConnected && (
            <div className="hint-showcase" aria-label="三种禁用提示示意">
              <p className="meta-label">三种禁用提示（示意，互不混用）</p>
              <p className="notice notice-admit" role="note">
                <strong>未准入。</strong>
                当前地址未完成该项目投资者准入……与下架、暂停无关。
              </p>
              <p className="notice notice-delisted" role="note">
                <strong>已下架。</strong>
                市场目录不可见或链上已关闭新认购……下架 ≠ 暂停。
              </p>
              <p className="notice notice-paused" role="note">
                <strong>柜台已暂停。</strong>
                本项目链上申购、赎回、改净值与领息均停止……这不是下架。
              </p>
            </div>
          )}

          <div className="ops-grid">
            <div className="panel">
              <h2>认购</h2>
              <label>
                USDC 数量
                <input
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  placeholder="100"
                  inputMode="decimal"
                  disabled={!isConnected || isDelisted || isPaused}
                />
              </label>
              <p className="estimate">
                认购预估份额：{" "}
                <strong>{formatAmount(estShares)}</strong>
                {nav !== undefined && depositAssets > 0n && (
                  <span className="muted"> · 按当前净值换算</span>
                )}
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    !isConnected ||
                    tx.isBusy ||
                    !canSubscribe ||
                    !needsApprove ||
                    depositAssets === 0n
                  }
                  onClick={onApprove}
                >
                  1. Approve
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={
                    !isConnected ||
                    tx.isBusy ||
                    !canSubscribe ||
                    needsApprove ||
                    depositAssets === 0n
                  }
                  onClick={onDeposit}
                >
                  2. 认购
                </button>
              </div>
              {canSubscribe && needsApprove && depositAssets > 0n && (
                <p className="hint">步骤 1：先 Approve USDC，成功后再认购。</p>
              )}
              {canSubscribe && !needsApprove && depositAssets > 0n && (
                <p className="hint">步骤 2：授权充足，可直接认购。</p>
              )}
              {approvePhaseHint}
              {depositPhaseHint}
            </div>

            <div className="panel">
              <h2>赎回</h2>
              <label>
                份额数量
                <input
                  value={redeemInput}
                  onChange={(e) => setRedeemInput(e.target.value)}
                  placeholder={shareBal ? formatAmount(shareBal) : "0"}
                  inputMode="decimal"
                  disabled={!isConnected || isPaused || notAdmitted}
                />
              </label>
              <p className="estimate">
                赎回预估 USDC：{" "}
                <strong>{formatAmount(estAssets)}</strong>
                {nav !== undefined && redeemShares > 0n && (
                  <span className="muted"> · 按当前净值换算</span>
                )}
              </p>
              <button
                type="button"
                className="btn primary"
                disabled={
                  !isConnected ||
                  tx.isBusy ||
                  redeemShares === 0n ||
                  notAdmitted ||
                  isPaused
                }
                onClick={onRedeem}
              >
                赎回
              </button>
            </div>

            <div className="panel">
              <h2>领取收益</h2>
              <p className="estimate">
                待领：<strong>{formatAmount(pendingYield)} mUSDC</strong>
              </p>
              <button
                type="button"
                className="btn primary"
                disabled={
                  !isConnected ||
                  tx.isBusy ||
                  notAdmitted ||
                  isPaused ||
                  !pendingYield ||
                  pendingYield === 0n
                }
                onClick={onClaim}
              >
                领取收益
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
