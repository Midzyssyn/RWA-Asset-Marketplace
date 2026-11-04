import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Address, isAddress, maxUint256, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ChainGuard } from "../components/ChainGuard";
import { CollapsiblePanel } from "../components/CollapsiblePanel";
import { StatusBadges } from "../components/StatusBadges";
import { TxBanner } from "../components/TxBanner";
import {
  ABIS,
  CONTRACTS,
  DEFAULT_ADMIN_ROLE,
  contractsConfigured,
} from "../config/contracts";
import { useDemoRole } from "../demo/DemoRoleContext";
import { useProjects } from "../hooks/useProjects";
import { useTx } from "../hooks/useTx";
import { formatAmount, parseAmount } from "../lib/units";

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const enabled = isConnected && !!address && contractsConfigured();
  const tx = useTx();
  const demo = useDemoRole();
  const { projects, refetch: refetchProjects } = useProjects(false);

  const [selectedId, setSelectedId] = useState<number>(0);
  const selected = projects.find((p) => p.id === selectedId) ?? projects[0];

  useEffect(() => {
    if (projects.length > 0 && !projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const [wlAddress, setWlAddress] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("1000");
  const [navInput, setNavInput] = useState("1.0");
  const [yieldAmount, setYieldAmount] = useState("10");
  const [navConfirmOpen, setNavConfirmOpen] = useState(false);

  const [regName, setRegName] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regShare, setRegShare] = useState("");
  const [regVault, setRegVault] = useState("");

  const share = selected?.share;
  const vault = selected?.vault;
  const projectReady = enabled && !!share && !!vault;

  const { data: nav, refetch: refetchNav } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "nav",
    query: { enabled: !!vault },
  });

  const { data: paused, refetch: refetchPaused } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "paused",
    query: { enabled: !!vault },
  });

  const { data: isShareAdmin } = useReadContract({
    address: share,
    abi: ABIS.rwaShare,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    query: { enabled: projectReady },
  });

  const { data: isVaultAdmin } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    query: { enabled: projectReady },
  });

  const { data: navManagerRole } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "NAV_MANAGER_ROLE",
    query: { enabled: !!vault },
  });

  const { data: isNavManager } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "hasRole",
    args:
      address && navManagerRole
        ? [navManagerRole, address]
        : undefined,
    query: { enabled: projectReady && !!navManagerRole },
  });

  const { data: depositsOpen, refetch: refetchDepositsOpen } = useReadContract({
    address: vault,
    abi: ABIS.rwaVault,
    functionName: "depositsOpen",
    query: { enabled: !!vault },
  });

  const { data: usdcOwner } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: ABIS.mockUsdc,
    functionName: "owner",
    query: { enabled: contractsConfigured() },
  });

  const { data: registryOwner } = useReadContract({
    address: CONTRACTS.projectRegistry,
    abi: ABIS.projectRegistry,
    functionName: "owner",
    query: { enabled: contractsConfigured() },
  });

  const { data: adminAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: ABIS.mockUsdc,
    functionName: "allowance",
    args: address && vault ? [address, vault] : undefined,
    query: { enabled: projectReady },
  });

  const isUsdcOwner =
    !!address &&
    !!usdcOwner &&
    usdcOwner.toLowerCase() === address.toLowerCase();
  const isRegistryOwner =
    !!address &&
    !!registryOwner &&
    registryOwner.toLowerCase() === address.toLowerCase();
  // 链上真实权限
  const canShareAdmin = Boolean(isShareAdmin);
  const canVaultAdmin = Boolean(isVaultAdmin);
  const canSetNav = Boolean(isNavManager);
  // 演示视角：界面是否露出该能力（单账号仍可用链上权限执行）
  const uiPlatform = demo.showPlatform;
  const uiProjectAdmin = demo.showProjectAdmin;
  const uiNav = demo.showNavManager;
  const uiInvestorOnly =
    demo.role === "investor" && !demo.showPlatform && !demo.showProjectAdmin && !demo.showNavManager;

  const refresh = () => {
    void refetchNav();
    void refetchPaused();
    void refetchAllowance();
    void refetchProjects();
    void refetchDepositsOpen();
  };

  const resolveAddr = (raw: string, fallback?: Address): Address | null => {
    const v = raw.trim() || fallback || "";
    if (!v || !isAddress(v)) return null;
    return v as Address;
  };

  const parsedNewNav = useMemo(() => {
    try {
      return parseAmount(navInput);
    } catch {
      return null;
    }
  }, [navInput]);

  const navImpact = useMemo(() => {
    if (nav === undefined || parsedNewNav === null || parsedNewNav === 0n) {
      return null;
    }
    if (parsedNewNav === nav) {
      return { pct: 0, direction: "unchanged" as const };
    }
    const up = parsedNewNav > nav;
    const delta = up ? parsedNewNav - nav : nav - parsedNewNav;
    const pct = Number((delta * 10000n) / nav) / 100;
    return {
      pct,
      direction: up ? ("up" as const) : ("down" as const),
    };
  }, [nav, parsedNewNav]);

  const onRegister = () => {
    const s = resolveAddr(regShare);
    const v = resolveAddr(regVault);
    if (!s || !v || !regName.trim() || !regCompany.trim()) return;
    void tx.send(
      {
        address: CONTRACTS.projectRegistry,
        abi: ABIS.projectRegistry,
        functionName: "registerProject",
        args: [regName.trim(), regDesc.trim(), regCompany.trim(), s, v, true],
      },
      "登记项目",
      refresh
    );
  };

  const onSetListed = (listed: boolean) => {
    if (!selected) return;
    const afterListed = () => {
      if (canVaultAdmin && vault) {
        void tx.send(
          {
            address: vault,
            abi: ABIS.rwaVault,
            functionName: "setDepositsOpen",
            args: [listed],
          },
          listed ? "打开新认购" : "关闭新认购",
          refresh
        );
      } else {
        refresh();
      }
    };
    void tx.send(
      {
        address: CONTRACTS.projectRegistry,
        abi: ABIS.projectRegistry,
        functionName: "setListed",
        args: [BigInt(selected.id), listed],
      },
      listed ? "上架项目" : "下架项目",
      afterListed
    );
  };

  const onAddWhitelist = () => {
    const target = resolveAddr(wlAddress);
    if (!target || !share) return;
    void tx.send(
      {
        address: share,
        abi: ABIS.rwaShare,
        functionName: "addToWhitelist",
        args: [target],
      },
      "投资者准入",
      refresh
    );
  };

  const onRemoveWhitelist = () => {
    const target = resolveAddr(wlAddress);
    if (!target || !share) return;
    void tx.send(
      {
        address: share,
        abi: ABIS.rwaShare,
        functionName: "removeFromWhitelist",
        args: [target],
      },
      "取消准入",
      refresh
    );
  };

  const onMint = () => {
    const to = resolveAddr(mintTo, address);
    if (!to) return;
    let amount: bigint;
    try {
      amount = parseAmount(mintAmount);
    } catch {
      return;
    }
    if (amount === 0n) return;
    void tx.send(
      {
        address: CONTRACTS.mockUsdc,
        abi: ABIS.mockUsdc,
        functionName: "mint",
        args: [to, amount],
      },
      "Mint USDC",
      refresh
    );
  };

  const submitSetNav = () => {
    if (!vault || parsedNewNav === null || parsedNewNav === 0n) return;
    setNavConfirmOpen(false);
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "setNAV",
        args: [parsedNewNav],
      },
      "更新项目份额净值",
      refresh
    );
  };

  const onSetNavClick = () => {
    if (parsedNewNav === null || parsedNewNav === 0n) return;
    setNavConfirmOpen(true);
  };

  const onApproveYield = () => {
    if (!vault) return;
    void tx.send(
      {
        address: CONTRACTS.mockUsdc,
        abi: ABIS.mockUsdc,
        functionName: "approve",
        args: [vault, maxUint256],
      },
      "Approve USDC for Yield",
      refresh
    );
  };

  const onDistribute = () => {
    if (!vault) return;
    let amount: bigint;
    try {
      amount = parseAmount(yieldAmount);
    } catch {
      return;
    }
    if (amount === 0n) return;
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "distributeYield",
        args: [amount],
      },
      "分配项目收益",
      refresh
    );
  };

  const onPause = () => {
    if (!vault) return;
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "pause",
      },
      "暂停柜台",
      refresh
    );
  };

  const onUnpause = () => {
    if (!vault) return;
    void tx.send(
      {
        address: vault,
        abi: ABIS.rwaVault,
        functionName: "unpause",
      },
      "恢复柜台",
      refresh
    );
  };

  const yieldNeedsApprove = (() => {
    try {
      const a = parseAmount(yieldAmount);
      return a > 0n && (adminAllowance === undefined || adminAllowance < a);
    } catch {
      return true;
    }
  })();

  return (
    <section className="page admin-page">
      <header className="admin-hero">
        <p className="eyebrow">运维控制台</p>
        <h1>Admin</h1>
        <p className="lede">
          用顶部「演示角色」切换视角（同一钱包即可讲解）。当前：
          <strong>{demo.def.label}</strong> — {demo.def.hint}
        </p>
      </header>

      <ChainGuard />
      <TxBanner
        phase={tx.phase}
        message={tx.message}
        hash={tx.hash}
        onDismiss={tx.reset}
      />

      {!isConnected && (
        <p className="notice">
          请先连接钱包后再操作。下方分区可先浏览：平台上架下架 ≠ 项目柜台暂停。
        </p>
      )}

      {demo.role === "investor" && (
        <p className="notice">
          当前演示角色是<strong>投资人</strong>：请到{" "}
          <Link to="/">资产市场</Link>{" "}
          认购 / 赎回 / 领息。Admin 页的运维面板已收起；可在顶部切到「平台 /
          项目 Admin / 净值经理」。
        </p>
      )}

      <div className="admin-zones-row">
          {/* ========== 平台 · 上架下架 ========== */}
          {uiPlatform && (
          <section className="admin-zone platform-zone">
            <div className="zone-header">
              <h2>平台 · 上架下架</h2>
              <p className="zone-desc">
                Registry Owner。只影响市场目录可见性；不停柜台、不锁资金。
              </p>
            </div>

            <div className="admin-module-stack">
            <CollapsiblePanel
              title="登记项目"
              summary="部署 Share+Vault 后登记进目录"
              defaultOpen={false}
            >
              <p className="hint">
                方案 B：先单独部署 Share+Vault，再登记进目录。
              </p>
              <label>
                项目名
                <input
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="某某光伏收益项目"
                />
              </label>
              <label>
                公司名
                <input
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  placeholder="某某科技"
                />
              </label>
              <label>
                简介
                <input
                  value={regDesc}
                  onChange={(e) => setRegDesc(e.target.value)}
                  placeholder="资产收益权说明"
                />
              </label>
              <label>
                Share 地址
                <input
                  value={regShare}
                  onChange={(e) => setRegShare(e.target.value)}
                  placeholder="0x…"
                />
              </label>
              <label>
                Vault 地址
                <input
                  value={regVault}
                  onChange={(e) => setRegVault(e.target.value)}
                  placeholder="0x…"
                />
              </label>
              <button
                type="button"
                className="btn primary"
                disabled={
                  tx.isBusy ||
                  !isRegistryOwner ||
                  !regName.trim() ||
                  !regCompany.trim() ||
                  !resolveAddr(regShare) ||
                  !resolveAddr(regVault)
                }
                onClick={onRegister}
              >
                登记并上架
              </button>
              {!isRegistryOwner && (
                <p className="hint">当前账户不是 Registry Owner，无法登记。</p>
              )}
            </CollapsiblePanel>

            <CollapsiblePanel
              title="选择项目 · 上架 / 下架"
              summary="只影响市场可见性，不停柜台、不锁资金"
              defaultOpen={false}
            >
              {projects.length === 0 ? (
                <p className="hint">暂无已登记项目。</p>
              ) : (
                <label>
                  当前项目
                  <select
                    value={selected?.id ?? 0}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} {p.companyName} · {p.name}
                        {p.listed ? "" : "（已下架）"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {selected && (
                <>
                  <StatusBadges listed={selected.listed} paused={paused} />
                  <p className="locked-copy">
                    上架 / 下架只影响市场可见性，不停柜台、不锁资金。
                    {canVaultAdmin
                      ? "（你是 Vault Admin 时会联调 depositsOpen，仅挡新认购。）"
                      : ""}
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={
                        tx.isBusy || !isRegistryOwner || selected.listed
                      }
                      onClick={() => onSetListed(true)}
                    >
                      上架
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={
                        tx.isBusy || !isRegistryOwner || !selected.listed
                      }
                      onClick={() => onSetListed(false)}
                    >
                      下架
                    </button>
                  </div>
                  <p className="hint">
                    目录 {selected.listed ? "已上架" : "已下架"} · 链上认购{" "}
                    {depositsOpen === undefined
                      ? "—"
                      : depositsOpen
                        ? "开"
                        : "关"}
                  </p>
                </>
              )}
            </CollapsiblePanel>
            </div>
          </section>
          )}

          {/* ========== 项目 · 净值/准入/收益/暂停 ========== */}
          {(uiProjectAdmin || uiNav) && (
          <section className="admin-zone project-zone">
              <div className="zone-header">
                <h2>
                  {uiNav && !uiProjectAdmin
                    ? "项目 · 净值"
                    : uiProjectAdmin && !uiNav
                      ? "项目 · 准入 / 收益 / 暂停"
                      : "项目 · 净值 / 准入 / 收益 / 暂停"}
                </h2>
                <p className="zone-desc">
                  {selected
                    ? `针对「${selected.companyName} · ${selected.name}」的柜台与份额业务，与平台上架无关。`
                    : "请先登记或选择项目（可切到「平台」角色）。"}
                </p>
              </div>

              {/* 未开平台区时仍要能选项目（净值经理 / 项目 Admin 单角色演示） */}
              {!uiPlatform && projects.length > 0 && (
                <label>
                  当前项目
                  <select
                    value={selected?.id ?? 0}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id} {p.companyName} · {p.name}
                        {p.listed ? "" : "（已下架）"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {!selected && (
                <p className="hint">暂无选中项目，项目级操作不可用。</p>
              )}

              {selected && (
              <>
              <div className="stat-grid compact">
                <div className="stat">
                  <span className="stat-label">当前净值</span>
                  <span className="stat-value">
                    {nav === undefined ? "—" : formatAmount(nav)}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">柜台</span>
                  <span className="stat-value">
                    {paused ? "柜台暂停" : "柜台开放"}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">权限</span>
                  <span className="stat-value">
                    Share {canShareAdmin ? "✓" : "—"} · Admin{" "}
                    {canVaultAdmin ? "✓" : "—"} · NAV {canSetNav ? "✓" : "—"} ·
                    USDC {isUsdcOwner ? "✓" : "—"}
                  </span>
                </div>
              </div>

              {!canVaultAdmin &&
                !canShareAdmin &&
                !canSetNav &&
                !isUsdcOwner && (
                  <p className="notice warn">
                    当前账户不是该项目 Admin / NAV 经理。按钮已禁用；合约侧仍会校验权限。
                  </p>
                )}

              <div className="admin-module-stack">
                {uiProjectAdmin && (
                <CollapsiblePanel
                  title="投资者准入"
                  summary="白名单增删"
                  defaultOpen={demo.role === "projectAdmin"}
                >
                  <label>
                    地址
                    <input
                      value={wlAddress}
                      onChange={(e) => setWlAddress(e.target.value)}
                      placeholder={address ?? zeroAddress}
                    />
                  </label>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        tx.isBusy ||
                        !canShareAdmin ||
                        !resolveAddr(wlAddress)
                      }
                      onClick={onAddWhitelist}
                    >
                      准入
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={
                        tx.isBusy ||
                        !canShareAdmin ||
                        !resolveAddr(wlAddress)
                      }
                      onClick={onRemoveWhitelist}
                    >
                      取消准入
                    </button>
                  </div>
                </CollapsiblePanel>
                )}

                {uiProjectAdmin && (
                <CollapsiblePanel
                  title="Mint 测试 USDC"
                  summary="给演示地址发测试币"
                  defaultOpen={false}
                >
                  <label>
                    收款地址（空则发自己）
                    <input
                      value={mintTo}
                      onChange={(e) => setMintTo(e.target.value)}
                      placeholder={address}
                    />
                  </label>
                  <label>
                    数量
                    <input
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={tx.isBusy || !isUsdcOwner}
                    onClick={onMint}
                  >
                    Mint USDC
                  </button>
                </CollapsiblePanel>
                )}

                {uiNav && (
                <CollapsiblePanel
                  title="更新份额净值（setNAV）"
                  summary="旧净值 → 新净值；提交前二次确认"
                  defaultOpen={demo.role === "navManager"}
                  className="highlight"
                >
                  <p className="hint">
                    仅 NAV_MANAGER_ROLE。只改本金兑换价，≠ 分配收益。护栏：±20%；抬价须金库偿付充足。
                  </p>
                  <div className="nav-compare">
                    <div>
                      <span className="meta-label">旧净值</span>
                      <strong>
                        {nav === undefined ? "—" : formatAmount(nav)}
                      </strong>
                    </div>
                    <span className="nav-arrow" aria-hidden>
                      →
                    </span>
                    <div>
                      <span className="meta-label">新净值</span>
                      <strong>
                        {parsedNewNav === null || parsedNewNav === 0n
                          ? "—"
                          : formatAmount(parsedNewNav)}
                      </strong>
                    </div>
                  </div>
                  {navImpact && navImpact.direction !== "unchanged" && (
                    <p className="hint">
                      对赎回的大致影响：同份额将
                      {navImpact.direction === "up" ? "多" : "少"}得约{" "}
                      <strong>{navImpact.pct.toFixed(2)}%</strong> USDC
                      （抬价抬赎回额，压价压赎回额）。
                    </p>
                  )}
                  {navImpact?.direction === "unchanged" && (
                    <p className="hint">新旧净值相同，无需提交。</p>
                  )}
                  <label>
                    新净值
                    <input
                      value={navInput}
                      onChange={(e) => {
                        setNavInput(e.target.value);
                        setNavConfirmOpen(false);
                      }}
                      inputMode="decimal"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={
                      tx.isBusy ||
                      !canSetNav ||
                      parsedNewNav === null ||
                      parsedNewNav === 0n
                    }
                    onClick={onSetNavClick}
                  >
                    更新净值
                  </button>
                  {!canSetNav && (
                    <p className="hint">
                      当前账户无 NAV_MANAGER_ROLE，无法改净值。
                    </p>
                  )}
                  {navConfirmOpen && (
                    <div className="confirm-box" role="alertdialog">
                      <p>
                        确认将净值从{" "}
                        <strong>
                          {nav === undefined ? "—" : formatAmount(nav)}
                        </strong>{" "}
                        改为{" "}
                        <strong>
                          {parsedNewNav === null
                            ? "—"
                            : formatAmount(parsedNewNav)}
                        </strong>
                        ？
                        {navImpact && navImpact.direction !== "unchanged"
                          ? ` 赎回额将约${
                              navImpact.direction === "up" ? "上升" : "下降"
                            } ${navImpact.pct.toFixed(2)}%。`
                          : ""}{" "}
                        提交后由钱包签名上链，受 ±20% 与偿付护栏约束。
                      </p>
                      <div className="btn-row">
                        <button
                          type="button"
                          className="btn primary"
                          disabled={tx.isBusy}
                          onClick={submitSetNav}
                        >
                          确认提交
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setNavConfirmOpen(false)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </CollapsiblePanel>
                )}

                {uiProjectAdmin && (
                <CollapsiblePanel
                  title="分配项目收益"
                  summary="Approve 后注入利息（与 setNAV 分轨）"
                  defaultOpen={false}
                >
                  <p className="hint">
                    Admin 先持有并 Approve USDC，再注入利息抬升 rewardIndex（与
                    setNAV 分轨）。
                  </p>
                  <label>
                    利息 USDC
                    <input
                      value={yieldAmount}
                      onChange={(e) => setYieldAmount(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={
                        tx.isBusy || !canVaultAdmin || !yieldNeedsApprove
                      }
                      onClick={onApproveYield}
                    >
                      Approve USDC
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        tx.isBusy || !canVaultAdmin || yieldNeedsApprove
                      }
                      onClick={onDistribute}
                    >
                      分配收益
                    </button>
                  </div>
                </CollapsiblePanel>
                )}

                {uiProjectAdmin && (
                <CollapsiblePanel
                  title="暂停 / 恢复柜台"
                  summary="停止申购赎回与改净值，不是下架"
                  defaultOpen={false}
                  className="pause-panel"
                >
                  <p className="locked-copy">
                    暂停 / 恢复：停止本项目链上申购赎回与改净值，不是下架。
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn ghost danger"
                      disabled={tx.isBusy || !canVaultAdmin || !!paused}
                      onClick={onPause}
                    >
                      暂停
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={tx.isBusy || !canVaultAdmin || !paused}
                      onClick={onUnpause}
                    >
                      恢复
                    </button>
                  </div>
                </CollapsiblePanel>
                )}
              </div>
              </>
              )}
          </section>
          )}
      </div>

      {uiInvestorOnly && (
        <p className="hint">
          提示：部署者钱包通常同时持有 Admin / NAV；顶部切角色只改展示，便于单人答辩。
        </p>
      )}
    </section>
  );
}
