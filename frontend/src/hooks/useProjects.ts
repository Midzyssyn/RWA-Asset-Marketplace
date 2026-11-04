import { useMemo } from "react";
import { useReadContract } from "wagmi";
import {
  ABIS,
  CONTRACTS,
  contractsConfigured,
  type OnChainProject,
} from "../config/contracts";

/** 从 ProjectRegistry 读取全部项目；可选只返回已上架 */
export function useProjects(listedOnly = true) {
  const enabled = contractsConfigured();

  const {
    data,
    refetch,
    isLoading,
    isError,
    error,
  } = useReadContract({
    address: CONTRACTS.projectRegistry,
    abi: ABIS.projectRegistry,
    functionName: "listProjects",
    query: { enabled },
  });

  const projects = useMemo(() => {
    const raw = (data ?? []) as OnChainProject[];
    return raw
      .map((p, id) => ({ id, ...p }))
      .filter((p) => (listedOnly ? p.listed : true));
  }, [data, listedOnly]);

  return { projects, refetch, isLoading, isError, error, enabled };
}

export function useProject(id: number | null) {
  const enabled = contractsConfigured() && id !== null && id >= 0;

  const { data, refetch, isLoading, isError } = useReadContract({
    address: CONTRACTS.projectRegistry,
    abi: ABIS.projectRegistry,
    functionName: "getProject",
    args: id !== null ? [BigInt(id)] : undefined,
    query: { enabled },
  });

  const project = data
    ? ({ id: id as number, ...(data as OnChainProject) } as OnChainProject & {
        id: number;
      })
    : undefined;

  return { project, refetch, isLoading, isError, enabled };
}
