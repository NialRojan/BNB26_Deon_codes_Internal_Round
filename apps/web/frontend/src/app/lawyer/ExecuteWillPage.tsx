import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

export default function ExecuteWillPage() {
  const { vaults, executeDigitalWill, lawFirm, setActiveVaultId, live } = useB2B2C();
  const [execError, setExecError] = useState<string | null>(null);

  // Find a vault ready for execution or default to vault-5
  const readyVaults = vaults.filter((v) => v.status === "READY FOR EXECUTION");
  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    readyVaults[0]?.id || "vault-5"
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executedSuccess, setExecutedSuccess] = useState(false);

  const targetVault = vaults.find((v) => v.id === selectedVaultId) || vaults[0];

  const handleTriggerExecution = async () => {
    setIsExecuting(true);
    if (live) {
      // Real: executeRelease() (if needed) then distribute(ETH) to every heir, signed by the firm wallet.
      setExecError(null);
      const ok = await (executeDigitalWill(targetVault.id) as unknown as Promise<boolean>);
      setIsExecuting(false);
      setShowConfirmModal(false);
      if (ok) setExecutedSuccess(true);
      else setExecError(live.lastError());
      return;
    }
    setTimeout(() => {
      executeDigitalWill(targetVault.id);
      setIsExecuting(false);
      setShowConfirmModal(false);
      setExecutedSuccess(true);
    }, 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">FIDUCIARY WILL EXECUTION</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Execute Digital Will</h2>
          <p className="text-xs text-[#718077]">
            Fiduciary legal execution of authenticated digital wills upon satisfaction of all gate conditions.
          </p>
        </div>
        <Link
          to="/lawyer"
          className="rounded-lg border border-[#dce4dc] px-3.5 py-1.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Lawyer Overview
        </Link>
      </div>
      {execError && <p role="alert" className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs text-[#8a2f28]">{execError}</p>}

      {executedSuccess ? (
        /* Executed Success Card */
        <div className="rounded-2xl border border-[#b9d79e] bg-[#f8faf4] p-8 text-center shadow-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#a3e635] text-2xl font-bold text-[#17221b]">
            ✓
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#276332]">
              TRANSACTION BROADCAST COMPLETE
            </span>
            <h3 className="mt-1 text-2xl font-bold text-[#17221b]">
              Digital Will Successfully Executed
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#68756c]">
              The estate of <b>{targetVault.clientName}</b> is now in sequential staged release.
              Stage 1 Legal Claim Packets have been unsealed and dispatched to <b>{lawFirm.name}</b>.
            </p>
          </div>

          <div className="mx-auto max-w-lg rounded-xl border border-[#e1e8e1] bg-white p-4 text-left text-xs shadow-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[#718077]">Status:</span>
              <b className="text-[#0369a1]">STAGE 1 RELEASED · STAGES 2 & 3 TIMELOCKED</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#718077]">Executor:</span>
              <b>{lawFirm.name} ({lawFirm.loggedLawyer})</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#718077]">Next Gate:</span>
              <span>Stage 2 Access Kit unlocks in 7 days for authorized heirs</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-3">
            <Link
              to="/heir"
              onClick={() => setActiveVaultId(targetVault.id)}
              className="rounded-lg bg-[#17221b] px-5 py-2.5 text-xs font-bold text-white hover:bg-black"
            >
              View Staged Release Portal →
            </Link>
            <Link
              to="/lawyer"
              className="rounded-lg border border-[#dce4dc] bg-white px-4 py-2.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
            >
              Return to Lawyer Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Target Vault Selector */}
          <div className="rounded-xl border border-[#e1e8e1] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
              <div>
                <label className="font-bold text-[#17221b] block">Select Client Vault for Execution</label>
                <p className="text-[#718077]">
                  Showing vaults currently in <b>READY FOR EXECUTION</b> or under final review.
                </p>
              </div>
              <select
                value={selectedVaultId}
                onChange={(e) => setSelectedVaultId(e.target.value)}
                className="rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-bold text-[#17221b]"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.clientName} — Status: {v.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recovery Summary Card */}
          <div className="rounded-xl border border-[#bae6fd] bg-[#f0f9ff] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#e0f2fe] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0369a1]">
                  RECOVERY SUMMARY & GATE CHECKLIST
                </span>
                <h3 className="text-xl font-bold text-[#17221b]">{targetVault.clientName}</h3>
                <span className="font-mono text-[11px] text-[#0369a1]">
                  Vault: {targetVault.vaultAddress}
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  targetVault.status === "READY FOR EXECUTION"
                    ? "bg-[#0284c7] text-white"
                    : "bg-[#fef2f2] text-[#b91c1c]"
                }`}
              >
                {targetVault.status}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg bg-white p-3.5 border border-[#e1e8e1] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#718077]">
                  1. Death Certificate Status
                </span>
                <div className="font-bold text-sm text-[#17221b]">
                  {targetVault.deathCertificateStatus === "Verified" ? "Verified ✓" : "Pending Inspection"}
                </div>
                <p className="text-[11px] text-[#68756c]">
                  Inspected and certified by {lawFirm.name}. Municipal registrar record verified.
                </p>
              </div>

              <div className="rounded-lg bg-white p-3.5 border border-[#e1e8e1] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#718077]">
                  2. Guardian Quorum Attestations
                </span>
                <div className="font-bold text-sm text-[#17221b]">
                  {targetVault.guardianAttestationsCount} / {targetVault.requiredApprovals} Approvals Recorded ✓
                </div>
                <p className="text-[11px] text-[#68756c]">
                  Independent key shares validated on-chain without gas requirements.
                </p>
              </div>

              <div className="rounded-lg bg-white p-3.5 border border-[#e1e8e1] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#718077]">
                  3. Owner Veto Window Status
                </span>
                <div className="font-bold text-sm text-[#17221b]">
                  {targetVault.status === "READY FOR EXECUTION"
                    ? "Veto Window Elapsed (48h/48h) ✓"
                    : "Veto Window In Progress"}
                </div>
                <p className="text-[11px] text-[#68756c]">
                  Client safety delay concluded without cancellation or dispute.
                </p>
              </div>

              <div className="rounded-lg bg-white p-3.5 border border-[#e1e8e1] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#718077]">
                  4. Beneficiaries on Record
                </span>
                <div className="font-bold text-sm text-[#17221b]">
                  {targetVault.heirs.length} Designated Heirs
                </div>
                <p className="text-[11px] text-[#68756c]">
                  {targetVault.heirs.map((h) => `${h.name} (${h.percentage}%)`).join(", ")}
                </p>
              </div>
            </div>

            {/* Execution CTA Banner */}
            <div className="rounded-xl border border-[#bae6fd] bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="font-bold text-base text-[#17221b]">Fiduciary Will Ready for Execution</h4>
                <p className="text-xs text-[#68756c]">
                  Executing will trigger contract release and unseal the executor legal packet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="rounded-lg bg-[#0284c7] px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-[#0369a1] transition whitespace-nowrap"
              >
                Execute Digital Will
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-[#edf0ed] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0369a1]">CONFIRM EXECUTION</span>
                <h3 className="text-lg font-bold text-[#17221b]">
                  Execute Digital Will for {targetVault.clientName}?
                </h3>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <p className="text-[#4b5563] leading-relaxed">
              You are about to sign the fiduciary will execution transaction as <b>{lawFirm.loggedLawyer}</b>. This will initiate the following automated actions:
            </p>

            <ul className="space-y-2 rounded-xl bg-[#f8faf7] p-3.5 border border-[#edf0ed] text-[11px] text-[#2b382e]">
              <li className="flex items-center gap-2">
                <span className="text-[#34a853] font-bold">✓</span>
                <span><b>Stage 1:</b> Instant release of legal folios and bank claim packets to Executor</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#0284c7] font-bold">✓</span>
                <span><b>Stage 2:</b> 7-day timelock countdown for password and access kits</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#f59e0b] font-bold">✓</span>
                <span><b>Stage 3:</b> Queuing of crypto asset distributions and per-asset installment rules</span>
              </li>
            </ul>

            <div className="flex justify-end gap-2 border-t border-[#edf0ed] pt-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-[#dce4dc] px-3.5 py-2 font-semibold text-[#2b382e]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleTriggerExecution}
                className="rounded-lg bg-[#0284c7] px-5 py-2 font-bold text-white hover:bg-[#0369a1] disabled:opacity-40"
              >
                {isExecuting ? "Broadcasting Fiduciary Execution…" : "Confirm & Execute Will"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
