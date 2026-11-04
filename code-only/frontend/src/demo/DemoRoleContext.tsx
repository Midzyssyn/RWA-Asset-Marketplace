import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * 演示角色 = 界面视角，不是链上换钱包。
 * 单账号若已持有多角色，合约仍按地址校验；此处只控制「演示时露出哪套按钮」。
 */
export type DemoRoleId =
  | "all"
  | "platform"
  | "projectAdmin"
  | "navManager"
  | "investor";

export type DemoRoleDef = {
  id: DemoRoleId;
  label: string;
  short: string;
  hint: string;
};

export const DEMO_ROLES: DemoRoleDef[] = [
  {
    id: "investor",
    label: "投资人",
    short: "认购/赎回/领息",
    hint: "看市场与项目页：认购、赎回、领收益。",
  },
  {
    id: "platform",
    label: "平台",
    short: "上架/下架",
    hint: "Admin 页左侧：登记项目、上架/下架目录。",
  },
  {
    id: "projectAdmin",
    label: "项目 Admin",
    short: "准入/派息/暂停",
    hint: "Admin 页：白名单、Mint、派息、暂停（不含改净值）。",
  },
  {
    id: "navManager",
    label: "净值经理",
    short: "只改净值",
    hint: "Admin 页：仅 setNAV（±20% / 抬价偿付护栏）。",
  },
  {
    id: "all",
    label: "全部",
    short: "调试全开",
    hint: "显示全部控件（适合自己调试，答辩时建议切到具体角色）。",
  },
];

const STORAGE_KEY = "rwa-demo-role";

function readStored(): DemoRoleId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && DEMO_ROLES.some((r) => r.id === v)) return v as DemoRoleId;
  } catch {
    /* ignore */
  }
  return "investor";
}

type DemoRoleContextValue = {
  role: DemoRoleId;
  setRole: (id: DemoRoleId) => void;
  def: DemoRoleDef;
  showPlatform: boolean;
  showProjectAdmin: boolean;
  showNavManager: boolean;
  showInvestor: boolean;
};

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null);

export function DemoRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DemoRoleId>(readStored);

  const setRole = (id: DemoRoleId) => {
    setRoleState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<DemoRoleContextValue>(() => {
    const def = DEMO_ROLES.find((r) => r.id === role) ?? DEMO_ROLES[0];
    const all = role === "all";
    return {
      role,
      setRole,
      def,
      showPlatform: all || role === "platform",
      showProjectAdmin: all || role === "projectAdmin",
      showNavManager: all || role === "navManager",
      showInvestor: all || role === "investor",
    };
  }, [role]);

  return (
    <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
  );
}

export function useDemoRole() {
  const ctx = useContext(DemoRoleContext);
  if (!ctx) {
    throw new Error("useDemoRole must be used within DemoRoleProvider");
  }
  return ctx;
}
