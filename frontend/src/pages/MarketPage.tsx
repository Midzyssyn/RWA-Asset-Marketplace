import { Link } from "react-router-dom";
import { useReadContracts } from "wagmi";
import { ChainGuard } from "../components/ChainGuard";
import { StatusBadges } from "../components/StatusBadges";
import { ABIS, contractsConfigured } from "../config/contracts";
import { useProjects } from "../hooks/useProjects";
import { formatAmount } from "../lib/units";

export function MarketPage() {
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
