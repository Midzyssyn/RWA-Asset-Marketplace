import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "../lib/units";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        className="btn primary"
        disabled={isPending}
        onClick={() => connect({ connector: connectors[0] })}
      >
        连接钱包
      </button>
    );
  }

  return (
    <div className="wallet-info">
      <span className="address">{shortenAddress(address)}</span>
      <button type="button" className="btn ghost" onClick={() => disconnect()}>
        断开
      </button>
    </div>
  );
}
