import { useCallback, useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Abi, Address, ContractFunctionName, ContractFunctionArgs } from "viem";

export type TxPhase = "idle" | "wallet" | "pending" | "success" | "error";

type SendArgs<TAbi extends Abi> = {
  address: Address;
  abi: TAbi;
  functionName: ContractFunctionName<TAbi, "nonpayable" | "payable">;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable">;
};

/**
 * 封装写交易：钱包确认 → 链上等待 → 成功/失败提示
 */
export function useTx() {
  const { writeContractAsync, reset: resetWrite } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!hash || phase !== "pending") return;
    if (receipt.isSuccess) {
      setPhase("success");
      setMessage(`${label || "交易"}成功`);
      onSuccessRef.current?.();
      onSuccessRef.current = undefined;
    } else if (receipt.isError) {
      setPhase("error");
      setMessage(shortenError(receipt.error?.message ?? "交易确认失败"));
    }
  }, [hash, phase, receipt.isSuccess, receipt.isError, receipt.error, label]);

  const reset = useCallback(() => {
    setHash(undefined);
    setPhase("idle");
    setMessage("");
    setLabel("");
    onSuccessRef.current = undefined;
    resetWrite();
  }, [resetWrite]);

  const send = useCallback(
    async <TAbi extends Abi>(
      params: SendArgs<TAbi>,
      actionLabel: string,
      onSuccess?: () => void
    ) => {
      setLabel(actionLabel);
      setPhase("wallet");
      setMessage(`请在钱包中确认：${actionLabel}`);
      setHash(undefined);
      onSuccessRef.current = onSuccess;
      try {
        const txHash = await writeContractAsync(params as never);
        setHash(txHash);
        setPhase("pending");
        setMessage(`${actionLabel} 已提交，等待确认…`);
      } catch (err) {
        setPhase("error");
        onSuccessRef.current = undefined;
        const msg =
          err instanceof Error ? err.message : String(err ?? "交易失败");
        setMessage(shortenError(msg));
      }
    },
    [writeContractAsync]
  );

  const isBusy = phase === "wallet" || phase === "pending";

  return {
    send,
    reset,
    phase,
    message,
    hash,
    isBusy,
    isSuccess: phase === "success",
    isError: phase === "error",
  };
}

function shortenError(msg: string): string {
  if (/User rejected|user rejected|denied/i.test(msg)) {
    return "用户取消了签名";
  }
  if (/NotWhitelisted/i.test(msg)) {
    return "地址不在白名单，请先联系管理员加名单";
  }
  if (/insufficient allowance|ERC20InsufficientAllowance/i.test(msg)) {
    return "USDC 授权额度不足，请先 Approve";
  }
  if (
    /OwnableUnauthorized|AccessControlUnauthorized|not owner|missing role/i.test(
      msg
    )
  ) {
    return "无权限：需要管理员账户";
  }
  if (msg.length > 180) return `${msg.slice(0, 180)}…`;
  return msg;
}
