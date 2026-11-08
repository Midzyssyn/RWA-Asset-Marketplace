import { useEffect, useMemo } from "react";
import {
  DEMO_ROLES,
  type DemoRoleId,
  useDemoRole,
} from "../demo/DemoRoleContext";

/** 市场页只露投资人；控制台露运维角色（平台 + 项目经理，不含投资人） */
const SCOPE_ROLES: Record<"market" | "admin", readonly DemoRoleId[]> = {
  market: ["investor"],
  admin: ["platform", "projectAdmin", "navManager", "all"],
};

type Props = {
  scope: "market" | "admin";
};

export function DemoRoleSwitch({ scope }: Props) {
  const { role, setRole, def } = useDemoRole();
  const allowed = SCOPE_ROLES[scope];
  const roles = useMemo(
    () => DEMO_ROLES.filter((r) => allowed.includes(r.id)),
    [allowed]
  );

  useEffect(() => {
    if (roles.length === 0) return;
    if (!allowed.includes(role)) {
      setRole(roles[0].id);
    }
  }, [allowed, role, roles, setRole]);

  const active = roles.find((r) => r.id === role) ?? roles[0] ?? def;

  return (
    <div className="demo-role-bar" role="group" aria-label="演示角色切换">
      <div className="demo-role-head">
        <span className="demo-role-title">演示角色</span>
        <span className="demo-role-note">
          {scope === "market"
            ? "本页：投资人视角"
            : "本页：运维视角 · 非换钱包"}
        </span>
      </div>
      <div className="demo-role-chips">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            className={
              role === r.id ? "demo-role-chip active" : "demo-role-chip"
            }
            onClick={() => setRole(r.id)}
            title={r.hint}
          >
            <span className="demo-role-chip-label">{r.label}</span>
            <span className="demo-role-chip-short">{r.short}</span>
          </button>
        ))}
      </div>
      <p className="demo-role-hint">{active.hint}</p>
    </div>
  );
}
