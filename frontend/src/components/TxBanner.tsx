import type { TxPhase } from "../hooks/useTx";

type Props = {
  phase: TxPhase;
  message: string;
  hash?: `0x${string}`;
  onDismiss?: () => void;
};

export function TxBanner({ phase, message, hash, onDismiss }: Props) {
  if (phase === "idle" || !message) return null;

  const className =
    phase === "success"
      ? "tx-banner success"
      : phase === "error"
        ? "tx-banner error"
        : "tx-banner pending";

  return (
    <div className={className} role="status">
      <div>
        <strong>
          {phase === "wallet" && "等待签名"}
          {phase === "pending" && "交易等待中"}
          {phase === "success" && "交易成功"}
          {phase === "error" && "交易失败"}
        </strong>
        <p>{message}</p>
        {hash && (
          <p className="muted mono">
            tx: {hash.slice(0, 10)}…{hash.slice(-8)}
          </p>
        )}
      </div>
      {(phase === "success" || phase === "error") && onDismiss && (
        <button type="button" className="btn ghost" onClick={onDismiss}>
          关闭
        </button>
      )}
    </div>
  );
}
