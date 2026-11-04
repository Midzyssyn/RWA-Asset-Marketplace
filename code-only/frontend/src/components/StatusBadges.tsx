type Props = {
  listed: boolean;
  paused: boolean | undefined;
  compact?: boolean;
};

/** 市场可见性 + 柜台状态，文案固定，禁止合成「可认购」 */
export function StatusBadges({ listed, paused, compact }: Props) {
  return (
    <div className={`status-badges${compact ? " compact" : ""}`}>
      <span
        className={`badge ${listed ? "badge-listed" : "badge-delisted"}`}
        title="市场目录可见性（Registry.listed），≠ 柜台暂停"
      >
        {listed ? "已上架" : "已下架"}
      </span>
      <span
        className={`badge ${
          paused === undefined
            ? "badge-unknown"
            : paused
              ? "badge-paused"
              : "badge-open"
        }`}
        title="Vault.paused：暂停则停止申购赎回与改净值"
      >
        {paused === undefined ? "柜台…" : paused ? "柜台暂停" : "柜台开放"}
      </span>
    </div>
  );
}
