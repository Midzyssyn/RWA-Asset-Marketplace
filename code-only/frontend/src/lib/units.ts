import { formatUnits, parseUnits } from "viem";

/** MockUSDC / RWAShare / nav 均为 6 位小数 */
export const DECIMALS = 6;

export function parseAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  return parseUnits(trimmed, DECIMALS);
}

export function formatAmount(value: bigint | undefined, digits = 6): string {
  if (value === undefined) return "—";
  const raw = formatUnits(value, DECIMALS);
  const [intPart, frac = ""] = raw.split(".");
  const fracTrimmed = frac.slice(0, digits).replace(/0+$/, "");
  return fracTrimmed ? `${intPart}.${fracTrimmed}` : intPart;
}

/** shares = assets * 1e6 / nav */
export function estimateShares(assets: bigint, nav: bigint): bigint {
  if (assets === 0n || nav === 0n) return 0n;
  return (assets * 10n ** BigInt(DECIMALS)) / nav;
}

/** assetsOut = shares * nav / 1e6 */
export function estimateAssets(shares: bigint, nav: bigint): bigint {
  if (shares === 0n || nav === 0n) return 0n;
  return (shares * nav) / 10n ** BigInt(DECIMALS);
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
