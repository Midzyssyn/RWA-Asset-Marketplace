import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { CHAIN_ID, contractsConfigured } from "../config/contracts";
import { defaultChain } from "../config/wagmi";

export function ChainGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!contractsConfigured()) {
    return (
      <div className="tx-banner error">
        <p>
          未配置合约地址。请复制 <code>frontend/.env.example</code> 为{" "}
          <code>frontend/.env</code>，填入{" "}
          <code>VITE_MOCK_USDC_ADDRESS</code>、{" "}
          <code>VITE_PROJECT_REGISTRY_ADDRESS</code> 与{" "}
          <code>VITE_CHAIN_ID</code>。
        </p>
      </div>
    );
  }

  if (isConnected && chainId !== CHAIN_ID) {
    return (
      <div className="tx-banner error">
        <div>
          <p>
            当前钱包链 ID 为 {chainId}，应用配置为 {CHAIN_ID}（
            {defaultChain.name}）。请切换网络后再操作。
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={isPending}
          onClick={() => switchChain({ chainId: CHAIN_ID })}
        >
          切换到 {defaultChain.name}
        </button>
      </div>
    );
  }

  return null;
}
