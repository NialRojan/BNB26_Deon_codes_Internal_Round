import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import AuditHealthBanner from "../../components/AuditHealthBanner";
import type { VaultStatus, ClientVault } from "../../data/mockData";

const statusColors: Record<VaultStatus, { bg: string; text: string; dot: string; border: string }> = {
  ACTIVE: { bg: "#e9f7ea", text: "#276332", dot: "#34a853", border: "#c2e7c7" },
  WATCH: { bg: "#fff7e6", text: "#9a6700", dot: "#f59e0b", border: "#fde3a7" },
  "RECOVERY PENDING": { bg: "#fff1eb", text: "#b43b17", dot: "#ea580c", border: "#fed7aa" },
  "VETO WINDOW": { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444", border: "#fecaca" },
  "READY FOR EXECUTION": { bg: "#e0f2fe", text: "#0369a1", dot: "#0284c7", border: "#bae6fd" },
  EXECUTED: { bg: "#f1f5f9", text: "#475569", dot: "#64748b", border: "#cbd5e1" },
};

export default function LawFirmDashboard() {
  const { lawFirm, vaults, setActiveVaultId } = useB2B2C();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [selectedVault, setSelectedVault] = useState<ClientVault | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const totalClients = vaults.length;
  const activeCount = vaults.filter((v) => v.status === "ACTIVE").length;
  const watchCount = vaults.filter((v) => v.status === "WATCH").length;
  const recoveryPendingCount = vaults.filter((v) => v.status === "RECOVERY PENDING").length;
  const vetoWindowCount = vaults.filter((v) => v.status === "VETO WINDOW").length;
  const readyCount = vaults.filter((v) => v.status === "READY FOR EXECUTION").length;
  const executedCount = vaults.filter((v) => v.status === "EXECUTED").length;

  const filteredVaults = vaults.filter((v) => {
    if (filter !== "ALL" && v.status !== filter) return false;
    if (
      search.trim() &&
      !v.clientName.toLowerCase().includes(search.toLowerCase()) &&
      !v.vaultAddress.toLowerCase().includes(search.toLowerCase()) &&
      !v.clientEmail.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleCopyOnboardingLink = (vault: ClientVault) => {
    const url = `${window.location.origin}/client/onboarding?vaultId=${vault.id}&client=${encodeURIComponent(vault.clientName)}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(vault.id);
    setTimeout(() => setCopiedLink(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Law Firm Workspace Header */}
      <section className="welcome-card" style={{ background: "#112417", minHeight: "180px" }}>
        <div className="welcome-copy" style={{ maxWidth: "700px", padding: "26px 30px" }}>
          <span className="welcome-kicker" style={{ color: "#a3e635" }}>
            B2B2C FIDUCIARY WORKSPACE · {lawFirm.name.toUpperCase()}
          </span>
          <h2 style={{ fontSize: "24px", margin: "6px 0 4px" }}>Law Firm Estate Administration</h2>
          <p style={{ fontSize: "12px", color: "#c1cfc4", maxWidth: "560px", lineHeight: "1.5" }}>
            Logged in as <b>{lawFirm.loggedLawyer}</b> ({lawFirm.lawyerRole}). Managing institutional digital wills, guardian thresholds, and estate verification.
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true" style={{ opacity: 0.6 }}>
          <div className="halo" />
          <div className="shield" style={{ background: "#a3e635" }}></div>
        </div>
        <div className="welcome-foot" style={{ fontSize: "9px" }}>
          <span>Institutional Fiduciary Custody Active · Bar Reg: {lawFirm.licenseNumber}</span>
          <span>{totalClients} Registered Estate Clients</span>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="metric-grid" aria-label="Law Firm Overview">
        <article className="metric-card">
          <div className="metric-head">
            <span>Total Clients</span>
          </div>
          <strong className="metric-value">{totalClients}</strong>
          <span className="metric-note">Under institutional care</span>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Active Vaults</span>
            <span className="metric-icon">✓</span>
          </div>
          <strong className="metric-value" style={{ color: "#276332" }}>{activeCount}</strong>
          <span className="metric-note">Normal heartbeat monitoring</span>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Watch / Recovery</span>
          </div>
          <strong className="metric-value" style={{ color: "#b43b17" }}>{watchCount + recoveryPendingCount + vetoWindowCount}</strong>
          <span className="metric-note">{recoveryPendingCount} pending, {vetoWindowCount} in veto</span>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Ready for Execution</span>
          </div>
          <strong className="metric-value" style={{ color: "#0369a1" }}>{readyCount}</strong>
          <span className="metric-note">{executedCount} wills completed</span>
        </article>
      </section>

      {/* Client List Toolbar */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="section-kicker">PORTFOLIO REGISTRY</span>
            <h3 className="text-base font-bold text-[#17221b]">Client Inheritance Vaults</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search by client or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[#dce4dc] px-3 py-1.5 text-xs text-[#17221b] outline-none focus:border-[#a3e635]"
              style={{ width: "240px" }}
            />
            <Link
              to="/lawyer/create"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-[#17221b] transition hover:brightness-95"
            >
              <span>+</span> New Vault
            </Link>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#edf0ed] pt-3 text-xs">
          {[
            { id: "ALL", label: `All (${vaults.length})` },
            { id: "ACTIVE", label: `Active (${activeCount})` },
            { id: "WATCH", label: `Watch (${watchCount})` },
            { id: "RECOVERY PENDING", label: `Recovery Pending (${recoveryPendingCount})` },
            { id: "VETO WINDOW", label: `Veto Window (${vetoWindowCount})` },
            { id: "READY FOR EXECUTION", label: `Ready for Execution (${readyCount})` },
            { id: "EXECUTED", label: `Executed (${executedCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilter(pill.id)}
              className={`rounded-full px-2.5 py-1 transition ${
                filter === pill.id
                  ? "bg-[#17221b] text-white font-semibold"
                  : "bg-[#f5f7f4] text-[#6b786e] hover:bg-[#e8eee7]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client Table View */}
      <div className="overflow-x-auto rounded-xl border border-[#e1e8e1] bg-white shadow-sm">
        <table className="w-full text-left text-xs text-[#17221b]">
          <thead className="border-b border-[#e1e8e1] bg-[#f8faf7] text-[10px] uppercase font-bold text-[#68756c] tracking-wider">
            <tr>
              <th className="px-4 py-3">Client & Vault</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Heirs & Percentages</th>
              <th className="px-3 py-3">Guardians / Quorum</th>
              <th className="px-3 py-3">Executor</th>
              <th className="px-3 py-3">Inactivity / Veto</th>
              <th className="px-3 py-3">Last Check-In</th>
              <th className="px-4 py-3 text-right">Fiduciary Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0ed]">
            {filteredVaults.map((vault) => {
              const sc = statusColors[vault.status];
              return (
                <tr key={vault.id} className="transition hover:bg-[#fafbfa]">
                  {/* Client & Address */}
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-sm text-[#17221b]">{vault.clientName}</div>
                    <div className="text-[11px] text-[#718077]">{vault.clientEmail}</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-[#869188]">
                      <span>{vault.vaultAddress.slice(0, 8)}...{vault.vaultAddress.slice(-6)}</span>
                      <button
                        onClick={() => navigator.clipboard?.writeText(vault.vaultAddress)}
                        title="Copy vault address"
                        className="text-[#3b7043] hover:underline"
                      >
                        copy
                      </button>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                      {vault.status}
                    </span>
                    <div className="mt-1 text-[10px] text-[#758179] max-w-[150px] leading-tight">
                      {vault.recoveryStatusDetail}
                    </div>
                  </td>

                  {/* Heirs */}
                  <td className="px-3 py-3.5">
                    <div className="font-semibold text-xs">{vault.heirs.length} heirs</div>
                    <div className="mt-0.5 text-[10px] text-[#6b786e]">
                      {vault.heirs.map((h) => `${h.name.split(" ")[0]} (${h.percentage}%)`).join(", ")}
                    </div>
                  </td>

                  {/* Guardians */}
                  <td className="px-3 py-3.5">
                    <div className="font-semibold text-xs">
                      {vault.guardians.length} guardians
                    </div>
                    <div className="mt-0.5 inline-block rounded bg-[#f0f4ef] px-1.5 py-0.5 text-[10px] font-medium text-[#2d4d35]">
                      {vault.requiredApprovals} of {vault.guardians.length} required
                    </div>
                  </td>

                  {/* Executor */}
                  <td className="px-3 py-3.5">
                    <div className="font-semibold text-xs text-[#17221b]">{vault.executor}</div>
                    <span className="text-[10px] text-[#869188]">Legal Nominee</span>
                  </td>

                  {/* Inactivity & Veto */}
                  <td className="px-3 py-3.5">
                    <div className="text-[11px] font-medium text-[#2b382e]">
                      Inactivity: <b>{vault.inactivityDays}d</b>
                    </div>
                    <div className="text-[10px] text-[#718077]">
                      Veto: <b>{vault.vetoHours}h</b>
                    </div>
                  </td>

                  {/* Last Check-in */}
                  <td className="px-3 py-3.5">
                    <div className="text-[11px] text-[#2b382e]">{vault.lastCheckIn}</div>
                    <span className="text-[10px] text-[#869188]">
                      {vault.status === "ACTIVE" ? "✓ Up to date" : "Follow-up"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setActiveVaultId(vault.id);
                          setSelectedVault(vault);
                        }}
                        className="rounded border border-[#dce4dc] bg-white px-2 py-1 text-[11px] font-medium text-[#2b382e] transition hover:bg-[#f5f7f4]"
                      >
                        Inspect
                      </button>

                      {vault.status === "READY FOR EXECUTION" ? (
                        <button
                          onClick={() => {
                            setActiveVaultId(vault.id);
                            navigate("/lawyer/execute");
                          }}
                          className="rounded bg-[#0284c7] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#0369a1]"
                        >
                          Execute Will
                        </button>
                      ) : vault.deathCertificateStatus === "Pending" ? (
                        <button
                          onClick={() => {
                            setActiveVaultId(vault.id);
                            navigate("/lawyer/verification");
                          }}
                          className="rounded bg-[#ea580c] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#c2410c]"
                        >
                          Verify Cert
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCopyOnboardingLink(vault)}
                          className="rounded border border-[#a3e635] bg-[#f8faf4] px-2 py-1 text-[11px] font-semibold text-[#276332] transition hover:bg-[#eaf4df]"
                        >
                          {copiedLink === vault.id ? "Link Copied ✓" : "Onboard Link"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit log runs in the backend; only real problems are shown here */}
      <AuditHealthBanner />

      {/* Client Vault Detailed Inspector Modal */}
      {selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#edf0ed] pb-4">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-[#68756c] uppercase">VAULT DOSSIER</span>
                <h3 className="text-xl font-bold text-[#17221b]">{selectedVault.clientName}</h3>
                <p className="text-xs text-[#718077]">{selectedVault.clientEmail} · {selectedVault.vaultAddress}</p>
              </div>
              <button
                onClick={() => setSelectedVault(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-[#f5f7f4] p-3">
                  <span className="text-[10px] text-[#6b786e]">Status</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{selectedVault.status}</div>
                </div>
                <div className="rounded-lg bg-[#f5f7f4] p-3">
                  <span className="text-[10px] text-[#6b786e]">Executor</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{selectedVault.executor}</div>
                </div>
                <div className="rounded-lg bg-[#f5f7f4] p-3">
                  <span className="text-[10px] text-[#6b786e]">Threshold</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{selectedVault.requiredApprovals} of {selectedVault.guardians.length}</div>
                </div>
                <div className="rounded-lg bg-[#f5f7f4] p-3">
                  <span className="text-[10px] text-[#6b786e]">Veto Window</span>
                  <div className="font-bold text-[#17221b] mt-0.5">{selectedVault.vetoHours} hours</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#17221b] mb-1.5">Designated Heirs ({selectedVault.heirs.length})</h4>
                <div className="divide-y divide-[#edf0ed] rounded-lg border border-[#e1e8e1]">
                  {selectedVault.heirs.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-2.5">
                      <div>
                        <b>{h.name}</b> <span className="text-[#718077]">({h.relationship})</span>
                        <div className="text-[10px] text-[#869188]">{h.contact} · {h.wallet}</div>
                      </div>
                      <span className="rounded-full bg-[#eaf4df] px-2 py-0.5 font-bold text-[#276332]">
                        {h.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#17221b] mb-1.5">Guardians ({selectedVault.guardians.length})</h4>
                <div className="divide-y divide-[#edf0ed] rounded-lg border border-[#e1e8e1]">
                  {selectedVault.guardians.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-2.5">
                      <div>
                        <b>{g.name}</b> <span className="text-[#718077]">({g.role})</span>
                        <div className="text-[10px] text-[#869188]">{g.contact} · {g.wallet}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${g.hasAttested ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {g.hasAttested ? "Attested ✓" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#17221b] mb-1.5">Registered Digital Assets ({selectedVault.assets.length})</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedVault.assets.map((a) => (
                    <div key={a.id} className="rounded-lg border border-[#e1e8e1] p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#17221b]">{a.name}</span>
                        <span className="text-[9px] uppercase font-bold text-[#477b4d]">{a.category}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#68756c]">{a.detail}</p>
                      {a.customRule && (
                        <div className="mt-1 rounded bg-[#f5f8f5] p-1 text-[10px] text-[#2d5836]">
                          Rule: {a.customRule}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0ed] pt-4">
              <button
                onClick={() => handleCopyOnboardingLink(selectedVault)}
                className="rounded-lg border border-[#a3e635] bg-[#f8faf4] px-4 py-2 text-xs font-semibold text-[#276332] hover:bg-[#eaf4df]"
              >
                {copiedLink === selectedVault.id ? "Onboarding Link Copied ✓" : "Copy Client Onboarding Link"}
              </button>
              <button
                onClick={() => setSelectedVault(null)}
                className="rounded-lg bg-[#17221b] px-4 py-2 text-xs font-semibold text-white hover:bg-black"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
