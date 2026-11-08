import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Address, isAddress, maxUint256, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ChainGuard } from "../components/ChainGuard";
import { DemoRoleSwitch } from "../components/DemoRoleSwitch";
import { StatusBadges } from "../components/StatusBadges";
import { TxBanner } from "../components/TxBanner";
import { WalletConnect } from "../components/WalletConnect";
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

type AdminMenuId =
  | "register"
  | "listing"
  | "overview"
  | "whitelist"
  | "mint"
  | "setnav"
  | "yield"
  | "pause";

type MenuItem = {
  id: AdminMenuId;
  label: string;
  group: "platform" | "project";
  need: "platform" | "projectAdmin" | "nav";
};

const MENU: MenuItem[] = [
  { id: "register", label: "登记项目", group: "platform", need: "platform" },
  { id: "listing", label: "上架 / 下架", group: "platform", need: "platform" },
  { id: "overview", label: "项目概览", group: "project", need: "projectAdmin" },
  { id: "whitelist", label: "投资者准入", group: "project", need: "projectAdmin" },
  { id: "mint", label: "Mint 测试 USDC", group: "project", need: "projectAdmin" },
  { id: "setnav", label: "更新净值", group: "project", need: "nav" },
  { id: "yield", label: "分配收益", group: "project", need: "projectAdmin" },
  { id: "pause", label: "暂停 / 恢复", group: "project", need: "projectAdmin" },
];

const TITLES: Record<AdminMenuId, { title: string; crumb: string }> = {
  register: { title: "登记项目", crumb: "平台 / 登记项目" },
  listing: { title: "上架 / 下架", crumb: "平台 / 上架下架" },
  overview: { title: "项目概览", crumb: "项目 / 概览" },
  whitelist: { title: "投资者准入", crumb: "项目 / 投资者准入" },
  mint: { title: "Mint 测试 USDC", crumb: "项目 / Mint USDC" },
  setnav: { title: "更新份额净值", crumb: "项目 / setNAV" },
  yield: { title: "分配项目收益", crumb: "项目 / 分配收益" },
  pause: { title: "暂停 / 恢复柜台", crumb: "项目 / 暂停恢复" },
};

function defaultMenu(opts: {
  platform: boolean;
  projectAdmin: boolean;
  nav: boolean;
}): AdminMenuId {
  if (opts.platform) return "listing";
  if (opts.nav && !opts.projectAdmin) return "setnav";
  if (opts.projectAdmin) return "overview";
  if (opts.nav) return "setnav";
  return "listing";
}

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const enabled = isConnected && !!address && contractsConfigured();
  const tx = useTx();
  const demo = useDemoRole();
  const { projects, refetch: refetchProjects } = useProjects(false);

  const uiPlatform = demo.showPlatform;
  const uiProjectAdmin = demo.showProjectAdmin;
  const uiNav = demo.showNavManager;
  const uiInvestorOnly =
    demo.role === "investor" &&
    !demo.showPlatform &&
    !demo.showProjectAdmin &&
    !demo.showNavManager;

  const visibleMenu = useMemo(
    () =>
      MENU.filter((m) => {
        if (m.need === "platform") return uiPlatform;
        if (m.need === "projectAdmin") return uiProjectAdmin;
        if (m.need === "nav") return uiNav;
        return false;
      }),
    [uiPlatform, uiProjectAdmin, uiNav]
  );

  const [menuId, setMenuId] = useState<AdminMenuId>(() =>
    defaultMenu({
      platform: demo.showPlatform,
      projectAdmin: demo.showProjectAdmin,
      nav: demo.showNavManager,
    })
  );

  useEffect(() => {
    if (uiInvestorOnly) return;
    if (!visibleMenu.some((m) => m.id === menuId)) {
      setMenuId(
        defaultMenu({
          platform: uiPlatform,
          projectAdmin: uiProjectAdmin,
          nav: uiNav,
        })
      );
    }
  }, [uiInvestorOnly, visibleMenu, menuId, uiPlatform, uiProjectAdmin, uiNav]);

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
      address && navManagerRole ? [navManagerRole, address] : undefined,
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
  const canShareAdmin = Boolean(isShareAdmin);
  const canVaultAdmin = Boolean(isVaultAdmin);
  const canSetNav = Boolean(isNavManager);

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

  const showProjectPicker =
    !uiInvestorOnly &&
    (menuId === "overview" ||
      menuId === "whitelist" ||
      menuId === "mint" ||
      menuId === "setnav" ||
      menuId === "yield" ||
      menuId === "pause" ||
      menuId === "listing");

  const meta = TITLES[menuId];
  const platformItems = visibleMenu.filter((m) => m.group === "platform");
  const projectItems = visibleMenu.filter((m) => m.group === "project");

  const projectSelect = (
    <label className="admin-inline-field">
      当前项目
      <select
        value={selected?.id ?? 0}
        onChange={(e) => setSelectedId(Number(e.target.value))}
      >
        {projects.length === 0 ? (
          <option value={0}>暂无项目</option>
        ) : (
          projects.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} {p.companyName} · {p.name}
              {p.listed ? "" : "（已下架）"}
            </option>
          ))
        )}
      </select>
    </label>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sider">
        <Link to="/" className="admin-sider-brand">
          <span className="logo-mark" aria-hidden />
          <span>
            <strong>RWA 运维</strong>
            <em>控制台</em>
          </span>
        </Link>

        <nav className="admin-menu" aria-label="运维菜单">
          {platformItems.length > 0 && (
            <div className="admin-menu-group">
              <p className="admin-menu-group-title">平台</p>
              {platformItems.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    menuId === m.id
                      ? "admin-menu-item active"
                      : "admin-menu-item"
                  }
                  onClick={() => setMenuId(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {projectItems.length > 0 && (
            <div className="admin-menu-group">
              <p className="admin-menu-group-title">项目</p>
              {projectItems.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    menuId === m.id
                      ? "admin-menu-item active"
                      : "admin-menu-item"
                  }
                  onClick={() => setMenuId(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {uiInvestorOnly && (
            <p className="admin-menu-empty">
              投资人视角无运维菜单，请到资产市场。
            </p>
          )}
        </nav>

        <div className="admin-sider-foot">
          <Link to="/" className="admin-sider-link">
            ← 返回资产市场
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="admin-breadcrumb">{meta.crumb}</p>
            <h1>{meta.title}</h1>
          </div>
          <div className="admin-topbar-right">
            <WalletConnect />
          </div>
        </header>

        <div className="admin-demo-strip">
          <DemoRoleSwitch scope="admin" />
        </div>

        <div className="admin-content">
          <ChainGuard />
          <TxBanner
            phase={tx.phase}
            message={tx.message}
            hash={tx.hash}
            onDismiss={tx.reset}
          />

          {!isConnected && (
            <p className="notice">
              请先连接钱包后再操作。可先浏览菜单：上架 ≠ 暂停。
            </p>
          )}

          {uiInvestorOnly && (
            <div className="admin-card">
              <p className="notice" style={{ marginTop: 0 }}>
                当前演示角色是<strong>投资人</strong>：请到{" "}
                <Link to="/">资产市场</Link>{" "}
                认购 / 赎回 / 领息。可在上方切到「平台 / 项目 Admin /
                净值经理」。
              </p>
            </div>
          )}

          {!uiInvestorOnly && (
            <div className="admin-card">
              {showProjectPicker && (
                <div className="admin-card-toolbar">
                  {projectSelect}
                  {selected && (
                    <StatusBadges listed={selected.listed} paused={paused} />
                  )}
                </div>
              )}

              {menuId === "register" && uiPlatform && (
                <div className="admin-form">
                  <p className="hint">
                    方案 B：先单独部署 Share+Vault，再登记进目录。只影响目录，不停柜台。
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
                    <p className="hint">
                      当前账户不是 Registry Owner，无法登记。
                    </p>
                  )}
                </div>
              )}

              {menuId === "listing" && uiPlatform && (
                <div className="admin-form">
                  <p className="locked-copy">
                    上架 / 下架只影响市场可见性，不停柜台、不锁资金。
                    {canVaultAdmin
                      ? "（你是 Vault Admin 时会联调 depositsOpen，仅挡新认购。）"
                      : ""}
                  </p>
                  {projects.length === 0 ? (
                    <p className="hint">暂无已登记项目。</p>
                  ) : (
                    selected && (
                      <>
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
                    )
                  )}
                </div>
              )}

              {menuId === "overview" && uiProjectAdmin && selected && (
                <div className="admin-form">
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
                        {canVaultAdmin ? "✓" : "—"} · NAV{" "}
                        {canSetNav ? "✓" : "—"} · USDC{" "}
                        {isUsdcOwner ? "✓" : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="hint">
                    左侧菜单进入准入 / 派息 / 暂停等操作。上架在「平台」分组。
                  </p>
                </div>
              )}

              {menuId === "whitelist" && uiProjectAdmin && (
                <div className="admin-form">
                  {!selected ? (
                    <p className="hint">暂无选中项目。</p>
                  ) : (
                    <>
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
                      <p className="hint">
                        取消准入前该地址份额须为 0；若仍有持仓，请先在项目页赎回清仓。
                      </p>
                    </>
                  )}
                </div>
              )}

              {menuId === "mint" && uiProjectAdmin && (
                <div className="admin-form">
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
                </div>
              )}

              {menuId === "setnav" && uiNav && (
                <div className="admin-form highlight">
                  {!selected ? (
                    <p className="hint">暂无选中项目。</p>
                  ) : (
                    <>
                      <p className="hint">
                        仅 NAV_MANAGER_ROLE。只改本金兑换价，≠
                        分配收益。护栏：±20%；抬价须金库偿付充足。
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
                          <strong>{navImpact.pct.toFixed(2)}%</strong> USDC。
                        </p>
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
                                  navImpact.direction === "up"
                                    ? "上升"
                                    : "下降"
                                } ${navImpact.pct.toFixed(2)}%。`
                              : ""}{" "}
                            提交后由钱包签名上链。
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
                    </>
                  )}
                </div>
              )}

              {menuId === "yield" && uiProjectAdmin && (
                <div className="admin-form">
                  <p className="hint">
                    Admin 先持有并 Approve USDC，再注入利息抬升
                    rewardIndex（与 setNAV 分轨）。
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
                </div>
              )}

              {menuId === "pause" && uiProjectAdmin && (
                <div className="admin-form pause-panel">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
