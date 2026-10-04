import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

export default function ClientVaultDashboard() {
  const { activeVault, cancelRecovery } = useB2B2C();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVetoModal, setShowVetoModal] = useState(false);
  const [ruleNotes, setRuleNotes] = useState("");
  const [policySaved, setPolicySaved] = useState(false);

  const isRecoveryActive =
    activeVault.status === "RECOVERY PENDING" || activeVault.status === "VETO WINDOW";

  const cryptoAssets = activeVault.assets.filter((a) => a.category === "Crypto");
  const accessAssets = activeVault.assets.filter((a) => a.category === "Access Kit");
  const legalAssets = activeVault.assets.filter((a) => a.category === "Legal / Asset Information");

  const handleConfirmCancelRecovery = () => {
    cancelRecovery(activeVault.id);
    setShowVetoModal(false);
  };

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    setPolicySaved(true);
    setTimeout(() => {
      setPolicySaved(false);
      setShowEditModal(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* VETO / RECOVERY ALERT BANNER (If Active) */}
      {isRecoveryActive && (
        <div className="rounded-xl border-2 border-[#ef4444] bg-[#fef2f2] p-4 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef4444] text-white font-bold text-lg">
                ⚠
              </span>
              <div>
                <h4 className="font-bold text-[#b91c1c] text-sm uppercase tracking-wide">
                  RECOVERY IN PROGRESS
                </h4>
                <p className="text-xs text-[#7f1d1d]">
                  An estate recovery request has been opened. If you are safe and want to stop this process:
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVetoModal(true)}
              className="rounded-lg bg-[#b91c1c] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#991b1b]"
            >
              [ CANCEL RECOVERY ]
            </button>
          </div>
        </div>
      )}

      {/* Client Vault Welcome Banner */}
      <section className="welcome-card" style={{ background: "#15241b", minHeight: "180px" }}>
        <div className="welcome-copy" style={{ maxWidth: "680px", padding: "24px 30px" }}>
          <span className="welcome-kicker" style={{ color: "#a3e635" }}>
            CLIENT PERSONAL VAULT · SOLE OWNER AUTHORITY
          </span>
          <h2 style={{ fontSize: "24px", margin: "6px 0 4px" }}>
            Welcome, {activeVault.clientName}
          </h2>
          <p style={{ fontSize: "12px", color: "#c1cfc4", maxWidth: "520px", lineHeight: "1.5" }}>
            Your digital legacy is secured under trust-minimized fiduciary custody with <b>{activeVault.executor}</b>. Only you can deposit crypto, seal passwords, or modify instructions.
          </p>
          <div className="welcome-actions" style={{ marginTop: "14px" }}>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "#276332", color: "#e8f8dc" }}
            >
              <span className="h-2 w-2 rounded-full bg-[#a3e635]" />
              {activeVault.status}
            </span>
            <Link
              to="/client/deposit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3e635] px-3.5 py-1.5 text-xs font-bold text-[#17221b] hover:brightness-95"
            >
              + Deposit Crypto
            </Link>
            <Link
              to="/client/seal"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              🔒 Seal Secret
            </Link>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              ⚙ Edit Rules
            </button>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true" style={{ opacity: 0.5 }}>
          <div className="halo" />
          <div className="shield" style={{ background: "#a3e635" }}>⌑</div>
        </div>
        <div className="welcome-foot" style={{ fontSize: "9px" }}>
          <span>Vault Contract: {activeVault.vaultAddress}</span>
          <span>Last Check-In: {activeVault.lastCheckIn}</span>
        </div>
      </section>

      {/* Vault Configuration Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* People */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#edf0ed] pb-2">
            <span className="text-[10px] uppercase font-bold text-[#718077]">PEOPLE ON RECORD</span>
            <span className="text-xs font-bold text-[#276332]">{activeVault.heirs.length} Heirs</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-[#718077]">Beneficiaries:</span>
              <div className="font-semibold text-[#17221b]">
                {activeVault.heirs.map((h) => `${h.name} (${h.percentage}%)`).join(", ")}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#718077]">Guardians ({activeVault.guardians.length}):</span>
              <div className="font-semibold text-[#17221b]">
                {activeVault.guardians.map((g) => g.name).join(", ")}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#718077]">Executor:</span>
              <div className="font-semibold text-[#17221b]">{activeVault.executor}</div>
            </div>
          </div>
        </div>

        {/* Recovery Timers */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#edf0ed] pb-2">
            <span className="text-[10px] uppercase font-bold text-[#718077]">SECURITY TIMERS</span>
            <span className="text-xs font-bold text-[#0369a1]">Active Heartbeat</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-[#718077]">Inactivity Period:</span>
              <div className="font-bold text-sm text-[#17221b]">{activeVault.inactivityDays} Days</div>
              <p className="text-[10px] text-[#718077]">Regular check-in expectation</p>
            </div>
            <div>
              <span className="text-[10px] text-[#718077]">Owner Veto Safety Delay:</span>
              <div className="font-bold text-sm text-[#17221b]">{activeVault.vetoHours} Hours</div>
              <p className="text-[10px] text-[#718077]">Mandatory pause before will execution</p>
            </div>
            <div>
              <span className="text-[10px] text-[#718077]">Required Guardian Quorum:</span>
              <div className="font-semibold text-[#17221b]">
                {activeVault.requiredApprovals} of {activeVault.guardians.length} approvals
              </div>
            </div>
          </div>
        </div>

        {/* Asset Distribution */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#edf0ed] pb-2">
            <span className="text-[10px] uppercase font-bold text-[#718077]">ASSETS PROTECTED</span>
            <Link to="/client/customize" className="text-xs font-bold text-[#3b7043] hover:underline">
              Per-Asset Rules ↗
            </Link>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span>🪙 Crypto Assets:</span>
              <b className="font-bold text-[#17221b]">{cryptoAssets.length} items</b>
            </div>
            <div className="flex justify-between items-center">
              <span>🔐 Sealed Passwords & Shards:</span>
              <b className="font-bold text-[#17221b]">{accessAssets.length} items</b>
            </div>
            <div className="flex justify-between items-center">
              <span>📑 Legal Probate Folios:</span>
              <b className="font-bold text-[#17221b]">{legalAssets.length} items</b>
            </div>
          </div>
          <div className="pt-1">
            <Link
              to="/client/assets"
              className="block rounded-lg bg-[#f5f8f5] py-2 text-center text-xs font-semibold text-[#276332] hover:bg-[#eaf4df]"
            >
              Manage Asset Inventory →
            </Link>
          </div>
        </div>
      </div>

      {/* Grouped Assets Display */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#edf0ed] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#17221b]">Protected Asset Portfolio</h3>
            <p className="text-xs text-[#718077]">
              Organized by release stage. Released sequentially only upon verified executor trigger.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/client/deposit"
              className="rounded-lg bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-[#17221b] hover:brightness-95"
            >
              + Deposit Crypto
            </Link>
            <Link
              to="/client/seal"
              className="rounded-lg bg-[#17221b] px-3 py-1.5 text-xs font-bold text-white hover:bg-black"
            >
              🔒 Seal Secret
            </Link>
          </div>
        </div>

        {/* Category 1: Crypto */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-xs uppercase text-[#276332]">Class 1 · Crypto & Digital Assets</span>
            <span className="text-[10px] text-[#718077]">(Stage 3 — Unlocks Last)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cryptoAssets.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-[#e1e8e1] p-3 text-xs bg-[#fafbfa]">
                <div className="flex justify-between font-bold text-[#17221b]">
                  <span>{asset.name}</span>
                  {asset.valueOrSize && <span className="text-[#276332]">{asset.valueOrSize}</span>}
                </div>
                <p className="mt-1 text-[11px] text-[#68756c]">{asset.detail}</p>
                {asset.customRule && (
                  <div className="mt-2 rounded bg-[#eaf4df] px-2 py-1 text-[10px] font-semibold text-[#276332]">
                    Rule: {asset.customRule}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Category 2: Access Kit */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-xs uppercase text-[#0369a1]">Class 2 · Access Kit & Password Shards</span>
            <span className="text-[10px] text-[#718077]">(Stage 2 — Timelocked)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {accessAssets.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-[#e1e8e1] p-3 text-xs bg-[#fafbfa]">
                <div className="flex justify-between font-bold text-[#17221b]">
                  <span>{asset.name}</span>
                  <span className="text-[9px] uppercase font-bold text-[#0369a1]">AES-256 Sealed</span>
                </div>
                <p className="mt-1 text-[11px] text-[#68756c]">{asset.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Category 3: Legal Information */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-xs uppercase text-[#9a6700]">Class 3 · Legal Folios & Bank Dossier</span>
            <span className="text-[10px] text-[#718077]">(Stage 1 — Released to Executor)</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {legalAssets.map((asset) => (
              <div key={asset.id} className="rounded-lg border border-[#e1e8e1] p-3 text-xs bg-[#fafbfa]">
                <div className="flex justify-between font-bold text-[#17221b]">
                  <span>{asset.name}</span>
                  {asset.institution && <span className="text-[10px] text-[#718077]">{asset.institution}</span>}
                </div>
                <p className="mt-1 text-[11px] text-[#68756c]">{asset.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Rules Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#edf0ed] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#3d8b50]">OWNER FIDUCIARY GOVERNANCE</span>
                <h3 className="text-lg font-bold text-[#17221b]">Edit Inheritance Rules</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="mt-4 rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-3 text-xs text-[#276332]">
              <b>Only the client can make changes.</b> Any modifications to heirs, percentages, or time-locks require client signature confirmation and update the on-chain policy.
            </div>

            <form onSubmit={handleSaveRules} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#2b382e] block mb-1">Update Policy Notes or Provisos</label>
                <textarea
                  rows={3}
                  value={ruleNotes}
                  onChange={(e) => setRuleNotes(e.target.value)}
                  placeholder="Specify updated conditions, change in executor instructions, or age conditions..."
                  className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#718077]">
                <span>Requires personal Web3 wallet signature</span>
                <span>Gasless signature relay</span>
              </div>

              {policySaved ? (
                <div className="rounded-lg bg-[#eaf4df] p-2.5 text-center font-bold text-[#276332]">
                  ✓ Policy Updated and Signed by Client!
                </div>
              ) : (
                <div className="flex justify-end gap-2 pt-2 border-t border-[#edf0ed]">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-lg border border-[#dce4dc] px-3 py-1.5 text-xs font-semibold text-[#2b382e]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[#17221b] px-4 py-1.5 text-xs font-bold text-white hover:bg-black"
                  >
                    Sign & Apply Policy
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Cancel Recovery Veto Confirmation Modal */}
      {showVetoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-[#ef4444] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2] text-xl font-bold">
                ⚠
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#17221b]">Cancel Recovery?</h3>
                <p className="text-xs text-[#718077]">Exercise owner veto power</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-[#4b5563] leading-relaxed">
              This will immediately terminate the pending recovery request, dismiss all guardian attestations, and <b>return your vault to ACTIVE</b> status.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowVetoModal(false)}
                className="rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
              >
                Keep Recovery
              </button>
              <button
                onClick={handleConfirmCancelRecovery}
                className="rounded-lg bg-[#b91c1c] px-4 py-2 text-xs font-bold text-white hover:bg-[#991b1b]"
              >
                Confirm: Cancel Recovery Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
