import { DEMO_ROLES, useDemoRole } from "../demo/DemoRoleContext";

export function DemoRoleSwitch() {
  const { role, setRole, def } = useDemoRole();

  return (
    <div className="demo-role-bar" role="group" aria-label="演示角色切换">
      <div className="demo-role-head">
        <span className="demo-role-title">演示角色</span>
        <span className="demo-role-note">单账号界面视角 · 非换钱包</span>
      </div>
      <div className="demo-role-chips">
        {DEMO_ROLES.map((r) => (
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
      <p className="demo-role-hint">{def.hint}</p>
    </div>
  );
}
