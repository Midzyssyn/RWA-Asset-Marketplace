import type { Address } from "viem";
import { MockUSDCAbi } from "../abi/MockUSDC";
import { ProjectRegistryAbi } from "../abi/ProjectRegistry";
import { RWAShareAbi } from "../abi/RWAShare";
import { RWAVaultAbi } from "../abi/RWAVault";

/**
 * 合约地址与链 ID 仅从 .env 读取（VITE_*）
 * 市场页以 ProjectRegistry 为准；各项目 Share/Vault 从 Registry 读取。
 */
export const CONTRACTS = {
  mockUsdc: (import.meta.env.VITE_MOCK_USDC_ADDRESS ?? "") as Address,
  projectRegistry: (import.meta.env.VITE_PROJECT_REGISTRY_ADDRESS ??
    "") as Address,
} as const;

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 31337);

export const ABIS = {
  mockUsdc: MockUSDCAbi,
  projectRegistry: ProjectRegistryAbi,
  rwaShare: RWAShareAbi,
  rwaVault: RWAVaultAbi,
} as const;

/** AccessControl DEFAULT_ADMIN_ROLE = bytes32(0) */
export const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export type OnChainProject = {
  name: string;
  description: string;
  companyName: string;
  share: Address;
  vault: Address;
  listed: boolean;
};

export function contractsConfigured(): boolean {
  return Boolean(
    CONTRACTS.mockUsdc &&
      CONTRACTS.projectRegistry &&
      CONTRACTS.mockUsdc.startsWith("0x") &&
      CONTRACTS.projectRegistry.startsWith("0x")
  );
}
