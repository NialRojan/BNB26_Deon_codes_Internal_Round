import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { useVault } from "../lib/vault";
import VetoBanner from "./VetoBanner";
import DemoBar from "./DemoBar";
import { TxToast, WalletButton } from "./ChainStatus";
import { Button, StateChip } from "./ui";

const groups = [
  { title: "OVERVIEW", links: [["/app", "Dashboard", "◫"], ["/setup", "Vault setup", "◇"], ["/assets", "Assets", "▤"], ["/people", "People & guardians", "♧"], ["/readiness", "Readiness", "✓"]] },
  { title: "RECOVERY PORTALS", links: [["/guardian", "Guardian portal", "◉"], ["/executor", "Executor portal", "▣"], ["/heir", "Beneficiary portal", "♡"]] },
];
const titles: Record<string, string> = { "/app": "Dashboard", "/setup": "Vault setup", "/assets": "Assets", "/people": "People & guardians", "/readiness": "Readiness", "/guardian": "Guardian portal", "/executor": "Executor portal", "/heir": "Beneficiary portal" };

export default function Shell() {
  const { pathname } = useLocation();
  const vault = useVault();
  const [open, setOpen] = useState(false);
  const title = titles[pathname] || "Heirloom";
  return <div className="app-shell">
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">☰</button>
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <NavLink to="/app" className="brand"><span className="brand-mark">H</span><span><b>HEIRLOOM</b><small>Digital Legacy Protocol</small></span></NavLink>
      <div className="workspace-switch"><span className="workspace-icon">✦</span><span><b>Personal vault</b><small>Owner workspace</small></span><span className="chevron">⌄</span></div>
      <nav aria-label="Main navigation">{groups.map(group => <section className="nav-group" key={group.title}><div className="nav-label">{group.title}</div>{group.links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === "/app"} onClick={() => setOpen(false)} className={({isActive}) => `nav-link ${isActive ? "active" : ""}`}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</section>)}</nav>
      <div className="sidebar-bottom"><NavLink to="/setup" className="nav-link"><span className="nav-icon">⚙</span>Settings</NavLink><div className="user-profile"><span className="avatar">O</span><span><b>Vault owner</b><small>Account administrator</small></span><span className="chevron">···</span></div></div>
    </aside>
    <div className="main-frame"><VetoBanner /><header className="topbar"><div><div className="eyebrow">HEIRLOOM <span>/</span> OWNER WORKSPACE</div><h1>{title}</h1></div><div className="top-actions"><StateChip state={vault.state}/><WalletButton/><Button onClick={vault.checkIn} disabled={!!vault.chain.busy}>Check in now <span aria-hidden>↗</span></Button></div></header><main className="page-canvas"><Outlet /></main><footer className="app-footer">Your digital legacy, thoughtfully protected <span>{vault.live ? "Live · HeirloomVault on Sepolia" : "Demo environment · Local browser state"}</span></footer></div>
    <DemoBar />
    <TxToast />
  </div>;
}
