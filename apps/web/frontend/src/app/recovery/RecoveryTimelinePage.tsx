import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import type { ClientVault } from "../../data/mockData";

interface TimelineStage {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  status: "completed" | "active" | "pending";
  detail: string;
  timeInfo?: string;
}

/** Recovery milestones for one vault (shared by this page and the lawyer's Inspect pop-up). */
export function buildRecoveryStages(vault: ClientVault, firmName: string): TimelineStage[] {
  return [
    {
      id: "s1",
      number: "01",
      title: "Recovery Initiated",
      subtitle: "Heartbeat expiry or verified heir notice",
      status: vault.status === "ACTIVE" ? "pending" : "completed",
      detail: vault.status === "ACTIVE" ? "Normal monitoring active" : "Recovery process initiated on-chain",
      timeInfo: "Completed",
    },
    {
      id: "s2",
      number: "02",
      title: "Evidence Verification",
      subtitle: "Death certificate review by law firm",
      status:
        vault.deathCertificateStatus === "Verified"
          ? "completed"
          : vault.deathCertificateStatus === "Pending"
          ? "active"
          : "pending",
      detail:
        vault.deathCertificateStatus === "Verified"
          ? "Death certificate inspected and verified by Mehta & Partners"
          : vault.deathCertificateStatus === "Pending"
          ? "Document submitted · Awaiting advocate review"
          : "No certificate required in current state",
      timeInfo: vault.deathCertificateStatus === "Verified" ? "Verified ✓" : undefined,
    },
    {
      id: "s3",
      number: "03",
      title: "Guardian Attestations",
      subtitle: `${vault.requiredApprovals} of ${vault.guardians.length} approvals required`,
      status:
        vault.guardianAttestationsCount >= vault.requiredApprovals
          ? "completed"
          : vault.status === "RECOVERY PENDING"
          ? "active"
          : "pending",
      detail: `${vault.guardianAttestationsCount} of ${vault.requiredApprovals} guardian key shares submitted`,
      timeInfo: `${vault.guardianAttestationsCount}/${vault.requiredApprovals} Signed`,
    },
    {
      id: "s4",
      number: "04",
      title: "Owner Veto Window",
      subtitle: `${vault.vetoHours} hours safety delay`,
      status:
        vault.status === "READY FOR EXECUTION" || vault.status === "EXECUTED"
          ? "completed"
          : vault.status === "VETO WINDOW"
          ? "active"
          : "pending",
      detail:
        vault.status === "VETO WINDOW"
          ? `Owner safety window active (${(vault.vetoTimeRemainingHours ?? 0).toFixed(1)}h remaining). Client retains 1-click cancellation.`
          : vault.status === "READY FOR EXECUTION" || vault.status === "EXECUTED"
          ? "Veto window safely elapsed without client cancellation"
          : `Will activate for ${vault.vetoHours}h once attestations and evidence are verified`,
      timeInfo: vault.status === "VETO WINDOW" ? `${(vault.vetoTimeRemainingHours ?? 0).toFixed(1)}h left` : undefined,
    },
    {
      id: "s5",
      number: "05",
      title: "Ready for Execution",
      subtitle: "Fiduciary release authorization",
      status:
        vault.status === "EXECUTED"
          ? "completed"
          : vault.status === "READY FOR EXECUTION"
          ? "active"
          : "pending",
      detail:
        vault.status === "READY FOR EXECUTION"
          ? "All conditions satisfied. Law firm can trigger digital will execution."
          : vault.status === "EXECUTED"
          ? `Digital will executed by ${firmName}`
          : "Locked until prior gates complete",
      timeInfo: vault.status === "READY FOR EXECUTION" ? "Ready Now" : undefined,
    },
    {
      id: "s6",
      number: "06",
      title: "Staged Release",
      subtitle: "Sequential asset unlocking (Passwords → Crypto)",
      status: vault.status === "EXECUTED" ? "active" : "pending",
      detail:
        vault.status === "EXECUTED"
          ? "Stage 1 (Passwords) Released · Stage 2 (Crypto) Timelocked"
          : "Sequential timelocks activate upon will execution",
      timeInfo: vault.status === "EXECUTED" ? "In Progress" : "Locked",
    },
  ];
}

/** Vertical milestone stepper. */
export function RecoveryStepper({ stages }: { stages: TimelineStage[] }) {
  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e1e8e1]">
      {stages.map((stg) => {
        const isDone = stg.status === "completed";
        const isActive = stg.status === "active";
        return (
          <div key={stg.id} className="relative flex items-start gap-4">
            {/* Milestone Node */}
            <div
              className={`absolute -left-6 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-white ${
                isDone
                  ? "bg-[#34a853] text-white"
                  : isActive
                  ? "bg-[#0284c7] text-white animate-pulse"
                  : "bg-[#e1e8e1] text-[#718077]"
              }`}
            >
              {isDone ? "✓" : isActive ? "●" : "○"}
            </div>

            {/* Milestone Content */}
            <div
              className={`flex-1 rounded-xl border p-4 text-xs transition ${
                isActive
                  ? "border-[#bae6fd] bg-[#f0f9ff]"
                  : isDone
                  ? "border-[#dcfce7] bg-[#f0fdf4]"
                  : "border-[#edf0ed] bg-[#fafbfa] opacity-75"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#718077]">
                    Stage {stg.number} · {stg.subtitle}
                  </span>
                  <h4 className="font-bold text-sm text-[#17221b] mt-0.5">{stg.title}</h4>
                </div>
                {stg.timeInfo && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isDone
                        ? "bg-[#dcfce7] text-[#166534]"
                        : isActive
                        ? "bg-[#e0f2fe] text-[#0369a1]"
                        : "bg-[#f1f5f9] text-[#475569]"
                    }`}
                  >
                    {stg.timeInfo}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-[#4b5563] leading-relaxed">{stg.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RecoveryTimelinePage() {
  const { vaults, activeVault, cancelRecovery, setActiveVaultId, lawFirm } = useB2B2C();
  const [showVetoConfirm, setShowVetoConfirm] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState(activeVault.id);

  const vault = vaults.find((v) => v.id === selectedVaultId) || activeVault;
  const isVetoActive = vault.status === "VETO WINDOW" || vault.status === "RECOVERY PENDING";

  const stages = buildRecoveryStages(vault, lawFirm.name);

  const handleCancelRecovery = () => {
    cancelRecovery(vault.id);
    setShowVetoConfirm(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header & Vault Switcher */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">END-TO-END RECOVERY ORCHESTRATION</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Recovery Status & Timeline</h2>
          <p className="text-xs text-[#718077]">
            Comprehensive state machine tracking death certificates, guardian quorums, and safety timelocks.
          </p>
        </div>

        {/* Vault Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#718077]">Select Vault:</label>
          <select
            value={selectedVaultId}
            onChange={(e) => {
              setSelectedVaultId(e.target.value);
              setActiveVaultId(e.target.value);
            }}
            className="rounded-lg border border-[#dce4dc] px-2.5 py-1.5 text-xs font-bold text-[#17221b]"
          >
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.clientName} — {v.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* OWNER VETO WARNING BANNER (Whenever recovery is active) */}
      {isVetoActive && (
        <div className="rounded-2xl border-2 border-[#ef4444] bg-[#fef2f2] p-5 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ef4444] text-white font-bold text-xl">
                !
              </span>
              <div>
                <h4 className="font-bold text-[#b91c1c] text-sm uppercase tracking-wider">
                  RECOVERY IN PROGRESS · {vault.status}
                </h4>
                <p className="text-xs text-[#7f1d1d] max-w-xl leading-relaxed">
                  A recovery sequence has been opened for <b>{vault.clientName}</b>.
                  If you are the living owner and safe, you can instantly terminate this process and restore your vault.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVetoConfirm(true)}
              className="rounded-lg bg-[#b91c1c] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#991b1b] transition whitespace-nowrap"
            >
              [ CANCEL RECOVERY ]
            </button>
          </div>
        </div>
      )}

      {/* Vault Quick Stat Summary */}
      <div className="grid gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Current Vault State</span>
          <div className="font-bold text-base text-[#17221b] mt-0.5">{vault.status}</div>
          <span className="text-[10px] text-[#276332]">On-Chain Monitored</span>
        </div>
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Guardian Approvals</span>
          <div className="font-bold text-base text-[#17221b] mt-0.5">
            {vault.guardianAttestationsCount} / {vault.requiredApprovals}
          </div>
          <span className="text-[10px] text-[#718077]">Quorum requirement</span>
        </div>
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Evidence Status</span>
          <div className="font-bold text-base text-[#17221b] mt-0.5">{vault.deathCertificateStatus}</div>
          <span className="text-[10px] text-[#718077]">Death certificate</span>
        </div>
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-3.5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Safety Veto Delay</span>
          <div className="font-bold text-base text-[#17221b] mt-0.5">{vault.vetoHours} Hours</div>
          <span className="text-[10px] text-[#718077]">Owner cancellation gate</span>
        </div>
      </div>

      {/* Visual Timeline Stepper */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-6">
        <div className="border-b border-[#edf0ed] pb-3">
          <h3 className="text-base font-bold text-[#17221b]">Estate Recovery Milestone Progress</h3>
          <p className="text-xs text-[#718077]">
            All conditions must be satisfied sequentially before the digital will can be executed.
          </p>
        </div>

        <RecoveryStepper stages={stages} />

        {/* Bottom Context & Direct Portal Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-4 text-xs">
          <span className="text-[11px] text-[#718077]">
            Monitored by Fiduciary Executor: <b>{vault.executor}</b>
          </span>
          <div className="flex gap-2">
            <Link
              to="/guardian"
              className="rounded-lg border border-[#dce4dc] px-3 py-1.5 font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
            >
              Guardian Attestation Portal →
            </Link>
            {vault.status === "READY FOR EXECUTION" && (
              <Link
                to="/lawyer/execute"
                className="rounded-lg bg-[#0284c7] px-3.5 py-1.5 font-bold text-white hover:bg-[#0369a1]"
              >
                Execute Digital Will Now →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* VETO CANCELLATION MODAL */}
      {showVetoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-[#ef4444] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2] text-xl font-bold">
                !
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#17221b]">Cancel Recovery?</h3>
                <p className="text-xs text-[#718077]">This will return your vault to ACTIVE.</p>
              </div>
            </div>

            <p className="text-xs text-[#4b5563] leading-relaxed">
              You are exercising your living owner veto right. All pending recovery requests and guardian attestations will be dismissed, and the vault heartbeat reset.
            </p>

            <div className="flex justify-end gap-2 border-t border-[#edf0ed] pt-3">
              <button
                type="button"
                onClick={() => setShowVetoConfirm(false)}
                className="rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold text-[#2b382e]"
              >
                Keep Recovery
              </button>
              <button
                type="button"
                onClick={handleCancelRecovery}
                className="rounded-lg bg-[#b91c1c] px-4 py-2 text-xs font-bold text-white hover:bg-[#991b1b]"
              >
                [ Cancel Recovery ]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
