import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useVault } from "../lib/vault";
import { useB2B2C, type Role } from "../lib/b2b2cStore";
import VetoBanner from "./VetoBanner";
import DemoBar from "./DemoBar";
import { TxToast, WalletButton } from "./ChainStatus";
import { B2BToast, FirmEmptyState, FirmSessionBar } from "./FirmSession";
import { Button, StateChip } from "./ui";

const roleInfo: Record<Role, { name: string; subtitle: string; icon: string; eyebrow: string }> = {
  lawyer: {
    name: "Mehta & Partners",
    subtitle: "Law Firm Fiduciary",
    icon: "L",
    eyebrow: "HEIRLOOM / LAW FIRM FIDUCIARY WORKSPACE",
  },
  client: {
    name: "Rahul Sharma",
    subtitle: "Vault Owner (Sole Authority)",
    icon: "C",
    eyebrow: "HEIRLOOM / CLIENT PRIVATE VAULT",
  },
  guardian: {
    name: "Vikram Sharma",
    subtitle: "Designated Key Guardian",
    icon: "G",
    eyebrow: "HEIRLOOM / GUARDIAN PORTAL",
  },
  heir: {
    name: "Arjun Sharma",
    subtitle: "Legal Heir / Executor",
    icon: "H",
    eyebrow: "HEIRLOOM / HEIR & EXECUTOR PORTAL",
  },
};

const lawyerLinks = [
  ["/lawyer", "Fiduciary Overview", ""],
  ["/lawyer/create", "Create Client Vault", ""],
  ["/lawyer/verification", "Document Verification", ""],
  ["/lawyer/execute", "Execute Digital Will", ""],
  ["/recovery", "Recovery Status Timeline", ""],
];

const clientLinks = [
  ["/client/vault", "My Vault Dashboard", ""],
  ["/client/onboarding", "Onboarding Review", ""],
  ["/client/assets", "Asset Classification", ""],
  ["/client/deposit", "Deposit Crypto", ""],
  ["/client/seal", "Seal Secret Browser-Side", ""],
  ["/client/customize", "Per-Asset Customization", ""],
  ["/recovery", "Recovery & Veto Status", ""],
];

const guardianLinks = [
  ["/guardian", "Pending Attestations", ""],
  ["/recovery", "Recovery State Machine", ""],
];

const heirLinks = [
  ["/heir/releases", "Staged Releases", ""],
  ["/executor", "Executor Legal Packet", ""],
  ["/heir", "Claim Beneficiary Assets", ""],
  ["/lawyer/verification", "Upload Death Certificate", ""],
];

const titles: Record<string, string> = {
  "/app": "Owner Dashboard",
  "/setup": "Vault setup",
  "/assets": "Assets",
  "/people": "People & guardians",
  "/readiness": "Readiness",
  "/guardian": "Guardian portal",
  "/executor": "Executor portal",
  "/heir": "Beneficiary portal",
  "/heir/releases": "Staged Releases",
  "/lawyer": "Law Firm Estate Dashboard",
  "/lawyer/create": "Create Client Vault",
  "/lawyer/verification": "Death Certificate Verification",
  "/lawyer/execute": "Execute Digital Will",
  "/client/vault": "Client Vault Dashboard",
  "/client/onboarding": "Review Digital Inheritance Plan",
  "/client/assets": "Asset Classification & Setup",
  "/client/deposit": "Deposit Crypto from Personal Wallet",
  "/client/seal": "Seal Browser Secret",
  "/client/customize": "Per-Asset Inheritance Customization",
  "/recovery": "Recovery Status & Timeline",
};

export default function Shell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const vault = useVault();
  const { role, setRole, activeVault, live, vaults } = useB2B2C();
  // A live law firm with no client vaults sees an empty state on lawyer pages (the wizard stays available).
  // The page decides the role: opening /guardian (by link or URL) acts as a guardian, etc.
  useEffect(() => {
    const byPath: [string, Role][] = [["/lawyer", "lawyer"], ["/client", "client"], ["/guardian", "guardian"], ["/heir", "heir"], ["/executor", "heir"]];
    const match = byPath.find(([prefix]) => pathname.startsWith(prefix));
    if (match && match[1] !== role) setRole(match[1]);
  }, [pathname, role, setRole]);
  const firmHasNoClients = !!live && role === "lawyer" && vaults.length === 0 && pathname.startsWith("/lawyer") && pathname !== "/lawyer/create";
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  const currentRole = roleInfo[role];
  const title = titles[pathname] || "Heirloom B2B2C";

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setSwitchOpen(false);
    if (r === "lawyer") navigate("/lawyer");
    else if (r === "client") navigate("/client/vault");
    else if (r === "guardian") navigate("/guardian");
    else if (r === "heir") navigate("/heir/releases");
  };

  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        {/* Brand */}
        <NavLink to="/app" className="brand">
          <span className="brand-mark">H</span>
          <span>
            <b>HEIRLOOM</b>
            <small>Fiduciary Legacy Protocol</small>
          </span>
        </NavLink>

        {/* Interactive Workspace / Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setSwitchOpen(!switchOpen)}
            className="w-full workspace-switch text-left transition hover:brightness-110"
            title="Switch User Role & Workspace"
          >
            <span className="workspace-icon">{currentRole.icon}</span>
            <div className="min-w-0 flex-1">
              <b className="truncate block">{currentRole.name}</b>
              <small className="truncate block">{currentRole.subtitle}</small>
            </div>
            <span className="chevron">⌄</span>
          </button>

          {switchOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#27352d] bg-[#111e16] p-1.5 shadow-2xl text-xs space-y-1">
              <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-[#718077] font-bold">
                Select Active Role
              </div>
              {(["lawyer", "client", "guardian", "heir"] as Role[]).map((r) => {
                const info = roleInfo[r];
                return (
                  <button
                    key={r}
                    onClick={() => handleRoleSelect(r)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                      role === r
                        ? "bg-[#1c2a21] text-[#a3e635] font-bold"
                        : "text-[#c2cec5] hover:bg-white/5"
                    }`}
                  >
                    <span className="text-sm">{info.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[11px] truncate">{info.name}</div>
                      <div className="text-[9px] text-[#718077] truncate">{info.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation adapted to Active Role */}
        <nav aria-label="Main navigation" className="overflow-y-auto">
          {role === "lawyer" && (
            <section className="nav-group">
              <div className="nav-label">LAWYER FIDUCIARY</div>
              {lawyerLinks.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/lawyer"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  {icon && <span className="nav-icon">{icon}</span>}
                  {label}
                </NavLink>
              ))}
            </section>
          )}

          {role === "client" && (
            <section className="nav-group">
              <div className="nav-label">CLIENT VAULT</div>
              {clientLinks.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  {icon && <span className="nav-icon">{icon}</span>}
                  {label}
                </NavLink>
              ))}
            </section>
          )}

          {role === "guardian" && (
            <section className="nav-group">
              <div className="nav-label">GUARDIAN PORTAL</div>
              {guardianLinks.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  {icon && <span className="nav-icon">{icon}</span>}
                  {label}
                </NavLink>
              ))}
            </section>
          )}

          {role === "heir" && (
            <section className="nav-group">
              <div className="nav-label">HEIR & EXECUTOR</div>
              {heirLinks.map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  {icon && <span className="nav-icon">{icon}</span>}
                  {label}
                </NavLink>
              ))}
            </section>
          )}

          {/* Quick Cross-Role Demo Switcher */}
          <section className="nav-group pt-4 border-t border-[#243129] mt-4">
            <div className="nav-label">DIRECT ROLE LINKS</div>
            <div className="grid grid-cols-2 gap-1 px-1">
              <NavLink
                to="/lawyer"
                className={({ isActive }) =>
                  `rounded px-2 py-1 text-[10px] text-center transition ${
                    isActive ? "bg-[#a3e635] text-[#17221b] font-bold" : "bg-[#111e16] text-[#aab5ad] hover:text-white"
                  }`
                }
              >
                Lawyer
              </NavLink>
              <NavLink
                to="/client/vault"
                className={({ isActive }) =>
                  `rounded px-2 py-1 text-[10px] text-center transition ${
                    isActive ? "bg-[#a3e635] text-[#17221b] font-bold" : "bg-[#111e16] text-[#aab5ad] hover:text-white"
                  }`
                }
              >
                Client
              </NavLink>
              <NavLink
                to="/guardian"
                className={({ isActive }) =>
                  `rounded px-2 py-1 text-[10px] text-center transition ${
                    isActive ? "bg-[#a3e635] text-[#17221b] font-bold" : "bg-[#111e16] text-[#aab5ad] hover:text-white"
                  }`
                }
              >
                Guardian
              </NavLink>
              <NavLink
                to="/heir/releases"
                className={({ isActive }) =>
                  `rounded px-2 py-1 text-[10px] text-center transition ${
                    isActive ? "bg-[#a3e635] text-[#17221b] font-bold" : "bg-[#111e16] text-[#aab5ad] hover:text-white"
                  }`
                }
              >
                Heir
              </NavLink>
            </div>
          </section>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-bottom">
          <NavLink to="/recovery" className="nav-link">
            
            Emergency Veto & Status
          </NavLink>
          <div className="user-profile">
            <span className="avatar" style={{ background: "#a3e635", color: "#111" }}>
              {currentRole.name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <b className="truncate block">{currentRole.name}</b>
              <small className="truncate block">{activeVault.clientName} Dossier</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-frame">
        <VetoBanner />

        <header className="topbar">
          <div>
            <div className="eyebrow">{currentRole.eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <span className="rounded-full border border-[#dce4dc] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2b382e]">
              Role: {role.toUpperCase()}
            </span>
            <StateChip state={vault.state} />
            <WalletButton />
            {pathname.startsWith("/client") && (
            <Button onClick={vault.checkIn} disabled={!!vault.chain.busy}>
              Check in now <span aria-hidden>↗</span>
            </Button>
            )}
          </div>
        </header>

        <main className="page-canvas">
          <FirmSessionBar />
          {firmHasNoClients ? <FirmEmptyState /> : <Outlet />}
        </main>

        <footer className="app-footer">
          Your digital legacy, thoughtfully protected{" "}
          <span>
            {vault.live ? "Live · HeirloomVault on Sepolia" : "Fiduciary Demo Environment · Local Browser State"}
          </span>
        </footer>
      </div>

      <DemoBar />
      <TxToast />
      <B2BToast />
    </div>
  );
}
