import { http, createConfig } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { CHAIN_ID } from "./contracts";

const chains = [hardhat, sepolia] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
  },
});

export const defaultChain = CHAIN_ID === sepolia.id ? sepolia : hardhat;
