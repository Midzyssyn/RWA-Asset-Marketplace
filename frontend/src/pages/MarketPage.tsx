import { Link } from "react-router-dom";
import { useReadContracts } from "wagmi";
import { ChainGuard } from "../components/ChainGuard";
import { StatusBadges } from "../components/StatusBadges";
import { ABIS, contractsConfigured } from "../config/contracts";
import { useDemoRole } from "../demo/DemoRoleContext";
import { useProjects } from "../hooks/useProjects";
import { formatAmount } from "../lib/units";

export function MarketPage() {
  const demo = useDemoRole();
  const { projects, refetch, isLoading, enabled } = useProjects(true);

  const navReads = useReadContracts({
    contracts: projects.map((p) => ({
      address: p.vault,
      abi: ABIS.rwaVault,
      functionName: "nav" as const,
    })),
    query: { enabled: enabled && projects.length > 0 },
  });

  const pausedReads = useReadContracts({
    contracts: projects.map((p) => ({
      address: p.vault,
      abi: ABIS.rwaVault,
      functionName: "paused" as const,
    })),
    query: { enabled: enabled && projects.length > 0 },
  });

  const refresh = () => {
    void refetch();
    void navReads.refetch();
    void pausedReads.refetch();
  };

  return (
    <section className="page market-page">
      <header className="market-hero">
        <p className="eyebrow">多公司 · 资产收益权</p>
        <p className="brand-lockup" aria-hidden="true">
          <span>RWA 资产市场</span>
        </p>
        <h1 className="visually-aside">RWA 资产市场</h1>
        <p className="lede">
          按净值认购份额。两枚徽章分开看：上架只管可见性，柜台才管申购赎回。
        </p>
        {!demo.showInvestor && demo.role !== "all" && (
          <p className="notice">
            当前演示角色是「{demo.def.label}」：市场页可浏览；运维请到{" "}
            <Link to="/admin">Admin</Link>。切到「投资人」再讲认购赎回更顺。
          </p>
        )}
      </header>

      <ChainGuard />

      {!contractsConfigured() && (
        <p className="notice warn">
          未配置合约地址。请将部署输出的{" "}
          <code>VITE_MOCK_USDC_ADDRESS</code> 与{" "}
          <code>VITE_PROJECT_REGISTRY_ADDRESS</code> 写入{" "}
          <code>frontend/.env</code> 后重启。
        </p>
      )}

      {contractsConfigured() && (
        <div className="market-body">
          <div className="market-toolbar">
            <h2 className="section-title">在售项目</h2>
            <div className="toolbar-actions">
              <span className="muted">
                {isLoading ? "加载中…" : `${projects.length} 个已上架`}
              </span>
              <button type="button" className="btn ghost" onClick={refresh}>
                刷新
              </button>
            </div>
          </div>

          {projects.length === 0 && !isLoading && (
            <p className="notice">暂无上架项目。请先部署或在 Admin 登记。</p>
          )}

          <div className="project-grid">
            {projects.map((p, idx) => {
              const nav = navReads.data?.[idx]?.result as bigint | undefined;
              const paused = pausedReads.data?.[idx]?.result as
                | boolean
                | undefined;
              return (
                <article key={p.id} className="project-card">
                  <div className="project-card-top">
                    <span className="company-tag">{p.companyName}</span>
                    <StatusBadges listed={p.listed} paused={paused} compact />
                  </div>
                  <h2>{p.name}</h2>
                  <p className="project-desc">{p.description}</p>
                  <div className="project-meta">
                    <span className="meta-label">当前净值</span>
                    <strong className="meta-nav">
                      {nav === undefined ? "—" : formatAmount(nav)}
                      <span className="meta-unit"> USDC / 份额</span>
                    </strong>
                  </div>
                  <Link className="btn primary" to={`/project/${p.id}`}>
                    查看详情
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
