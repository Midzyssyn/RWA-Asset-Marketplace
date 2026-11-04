import { NavLink } from "react-router-dom";
import { DemoRoleSwitch } from "./DemoRoleSwitch";
import { WalletConnect } from "./WalletConnect";

const links: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "资产市场", end: true },
  { to: "/admin", label: "Admin" },
];

export function Header() {
  return (
    <header className="header-wrap">
      <div className="header">
        <NavLink to="/" className="logo" end>
          RWA 资产市场
        </NavLink>
        <nav className="nav">
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <WalletConnect />
      </div>
      <DemoRoleSwitch />
    </header>
  );
}
