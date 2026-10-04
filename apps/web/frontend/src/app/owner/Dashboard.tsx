import { Link } from "react-router-dom";
import { useVault } from "../../lib/vault";
import { computeReadiness } from "../../lib/readiness";
import { ago, period } from "../../lib/time";
import { Button, StateChip } from "../../components/ui";

const releaseStages = [
  [1, "Legal claim packet", "Executor access · nominees and claim instructions"],
  [2, "Access kit", "Scoped recovery materials · authorized beneficiaries"],
  [3, "Crypto recovery", "Additional verification · final time-lock"],
] as const;

export default function Dashboard() {
  const v = useVault();
  const { checks } = computeReadiness(v);
  const incomplete = checks.filter(c => c.status !== "pass").length;
  const due = v.lastCheckIn + v.policy.checkInDays * 86400000;
  const open = v.state === "TriggerPending" || v.state === "VetoWindow";
  const stageState = (n: number) => v.state === "Executed" || v.stage > n ? "Complete" : v.state === "StagedRelease" && v.stage === n ? "In progress" : "Locked";
  return <div className="dashboard-page">
    <section className="welcome-card">
      <div className="welcome-copy"><span className="welcome-kicker">YOUR LEGACY, IN GOOD HANDS</span><h2>Good evening, Owner</h2><p>Your digital legacy is protected. Review your vault status and recovery readiness.</p><div className="welcome-actions"><StateChip state={v.state}/>{open ? <Button onClick={v.cancelRecovery}>I’m safe — cancel recovery</Button> : <Button onClick={v.checkIn}>Check in now <span>→</span></Button>}<Link to="/setup" className="text-link">View release policy <span>↗</span></Link></div></div>
      <div className="welcome-art" aria-hidden="true"><div className="halo"/><div className="shield"></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/></div>
      <div className="welcome-foot"><span><i/> Monitoring is active</span><span>Last check-in {ago(v.lastCheckIn)}</span></div>
    </section>

    <section className="metric-grid" aria-label="Vault summary">
      <article className="metric-card"><div className="metric-head"><span>Vault status</span></div><strong className="metric-value metric-state">{v.state.replace(/([A-Z])/g, " $1").trim()}</strong><span className="metric-note"><i className="status-dot"/> Current vault state</span></article>
      <article className="metric-card"><div className="metric-head"><span>Guardian coverage</span></div><strong className="metric-value">{v.live && v.chain.vault ? v.chain.vault.guardians.length : v.guardians.length} <small>/ {v.k} required</small></strong><span className="metric-note">{v.live && v.chain.vault ? `On-chain guardians · ${v.chain.vault.currentSignatures} confirmed this round` : `Configured guardians · ${v.k} approvals needed`}</span></article>
      <article className="metric-card"><div className="metric-head"><span>Assets protected</span></div><strong className="metric-value">{v.assets.length} <small>assets</small></strong><span className="metric-note">{v.heirs.length} people assigned as recipients</span></article>
      <article className="metric-card"><div className="metric-head"><span>Next check-in due</span></div><strong className="metric-value metric-date">{new Date(due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><span className="metric-note">Every {period(v.policy.checkInDays)} · Last {ago(v.lastCheckIn)}</span></article>
    </section>

    <div className="dashboard-columns"><section className="content-card activity-card"><div className="section-heading"><div><span className="section-kicker">VAULT ACTIVITY</span><h3>Recent activity</h3></div><Link to="/readiness" className="subtle-link">View readiness <span>↗</span></Link></div><div className="activity-list">{v.events.slice(0, 5).map((e, i) => <article className="activity-row" key={e.id}><span className={`activity-marker ${e.tone}`}>{e.tone === "ok" ? "✓" : e.tone === "warn" ? "!" : "×"}</span><div className="activity-copy"><b>{e.text}</b><small>{i === 0 ? "Vault activity" : "Security record"}</small></div><time>{ago(e.at)}</time></article>)}</div></section>
      <section className="content-card readiness-card"><div className="section-heading"><div><span className="section-kicker">SETUP OVERVIEW</span><h3>Recovery readiness</h3></div><span className={`readiness-mark ${incomplete ? "needs-work" : "ready"}`}>{incomplete ? "!" : "✓"}</span></div><p className="readiness-summary">{incomplete ? `${incomplete} setup ${incomplete === 1 ? "item needs" : "items need"} your attention.` : "Your setup checks are complete."}</p><div className="readiness-line"><span style={{width: `${Math.max(4, ((checks.length - incomplete) / checks.length) * 100)}%`}}/></div><div className="readiness-meta"><span>{checks.length - incomplete} of {checks.length} checks complete</span><Link to="/readiness">Review checks <span>→</span></Link></div><div className="attention-box"><span>Next recommended step</span><b>{checks.find(c => c.status !== "pass")?.title || "Review your release policy"}</b><Link to={checks.find(c => c.status !== "pass")?.fix?.to || "/readiness"}>Take a look ↗</Link></div></section></div>

    <section className="content-card release-card"><div className="section-heading"><div><span className="section-kicker">IF RECOVERY IS AUTHORIZED</span><h3>Release stages</h3><p>Materials are made available only after the required checks and time-locks.</p></div><Link to="/setup" className="subtle-link">Manage policy ↗</Link></div><div className="release-stages">{releaseStages.map(([n, title, desc]) => { const status = stageState(n); return <article className={`release-stage ${status === "In progress" ? "current" : ""}`} key={n}><div className="stage-number">{status === "Complete" ? "✓" : `0${n}`}</div><div className="stage-copy"><span>STAGE 0{n}</span><b>{title}</b><small>{desc}</small></div><span className={`stage-status ${status === "In progress" ? "in-progress" : ""}`}>{status}</span></article>})}</div><div className="release-note"><span>ⓘ</span> Current state: <b>{v.state}</b>. Stage availability reflects local demo state and does not represent a backend release authorization.</div></section>
  </div>;
}
