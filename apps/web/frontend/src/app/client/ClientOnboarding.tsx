import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

export default function ClientOnboarding() {
  const { vaults, setRole, setActiveVaultId } = useB2B2C();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const vaultId = searchParams.get("vaultId") || "vault-1";
  const targetVault = vaults.find((v) => v.id === vaultId) || vaults[0];

  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmAndContinue = () => {
    setActiveVaultId(targetVault.id);
    setRole("client");
    navigate("/client/assets");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      {/* Onboarding Banner */}
      <div className="rounded-2xl border border-[#b9d79e] bg-[#f8faf4] p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-[#34a853] uppercase tracking-wider">
          <span>●</span> Law Firm Prepared Dossier
        </div>
        <h2 className="mt-1 text-2xl font-bold text-[#17221b]">
          Review your digital inheritance plan
        </h2>
        <p className="mt-1 text-xs text-[#556358] leading-relaxed">
          <b>{targetVault.executor}</b> has prepared this digital vault for <b>{targetVault.clientName}</b> based on your fiduciary instructions.
          Please review the designated heirs, trusted guardians, and security time-locks before sealing assets.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-[#477b4d] bg-white rounded-lg p-2.5 border border-[#e1e8e1]">
          <span>Vault: <b>{targetVault.vaultAddress.slice(0, 10)}...{targetVault.vaultAddress.slice(-8)}</b></span>
          <span>Status: <b>{targetVault.status}</b></span>
          <span>Fiduciary: <b>{targetVault.executor}</b></span>
        </div>
      </div>

      {/* Review Steps */}
      <div className="space-y-4">
        {/* Step 1 — Review Heirs */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#edf0ed] pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#718077]">Step 1</span>
              <h3 className="text-base font-bold text-[#17221b]">Review Designated Heirs</h3>
            </div>
            <span className="rounded-full bg-[#eaf4df] px-2.5 py-0.5 text-xs font-bold text-[#276332]">
              100% Allocated ✓
            </span>
          </div>
          <div className="mt-3 divide-y divide-[#edf0ed]">
            {targetVault.heirs.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <b className="text-sm text-[#17221b]">{h.name}</b>{" "}
                  <span className="text-[#718077]">({h.relationship})</span>
                  <div className="text-[11px] text-[#869188]">{h.contact} · {h.wallet}</div>
                </div>
                <div className="rounded-lg bg-[#f5f8f5] px-3 py-1 font-bold text-sm text-[#276332]">
                  {h.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2 — Review Guardians */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#edf0ed] pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#718077]">Step 2</span>
              <h3 className="text-base font-bold text-[#17221b]">Review Guardians & Quorum</h3>
            </div>
            <span className="rounded-full bg-[#f0f4ef] px-2.5 py-0.5 text-xs font-bold text-[#2d4d35]">
              {targetVault.requiredApprovals} of {targetVault.guardians.length} Approvals Required
            </span>
          </div>
          <p className="mt-2 text-xs text-[#718077]">
            These trusted parties hold distributed key shares. Recovery requires at least {targetVault.requiredApprovals} independent attestations.
          </p>
          <div className="mt-3 space-y-2">
            {targetVault.guardians.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border border-[#e1e8e1] p-2.5 text-xs">
                <div>
                  <b className="text-[#17221b]">{g.name}</b>{" "}
                  <span className="text-[#718077]">({g.role})</span>
                  <div className="text-[10px] text-[#869188]">{g.contact} · {g.wallet.slice(0, 16)}...</div>
                </div>
                <span className="text-[10px] text-[#477b4d] font-semibold bg-[#eaf4df] px-2 py-0.5 rounded">
                  Key Shareholder
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3 — Review Executor */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Step 3</span>
          <h3 className="text-base font-bold text-[#17221b]">Review Nominated Executor</h3>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#b9d79e] bg-[#f8faf4] p-3 text-xs">
            <div>
              <b className="text-sm text-[#17221b]">{targetVault.executor}</b>
              <p className="text-[11px] text-[#68756c]">
                Fiduciary executor responsible for processing death certificate verification, executing the digital will, and releasing legal claims to banks.
              </p>
            </div>
            <span className="text-xs font-bold text-[#276332]">Authorized ✓</span>
          </div>
        </div>

        {/* Step 4 — Review Recovery Rules */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Step 4</span>
          <h3 className="text-base font-bold text-[#17221b]">Review Recovery Rules & Safety Delay</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg border border-[#e1e8e1] p-3">
              <span className="text-[10px] uppercase font-bold text-[#718077]">Inactivity Period</span>
              <div className="font-bold text-base text-[#17221b] mt-0.5">{targetVault.inactivityDays} Days</div>
              <p className="text-[11px] text-[#68756c]">
                Heartbeat check-in frequency before guardians can be alerted.
              </p>
            </div>
            <div className="rounded-lg border border-[#e1e8e1] p-3">
              <span className="text-[10px] uppercase font-bold text-[#718077]">Owner Veto Window</span>
              <div className="font-bold text-base text-[#17221b] mt-0.5">{targetVault.vetoHours} Hours</div>
              <p className="text-[11px] text-[#68756c]">
                Mandatory delay before execution during which you can cancel recovery with 1-click.
              </p>
            </div>
          </div>
        </div>

        {/* Step 5 — Client Confirmation */}
        <div className="rounded-xl border-2 border-[#17221b] bg-[#fbfcfb] p-5 shadow-sm space-y-4">
          <span className="text-[10px] uppercase font-bold text-[#718077]">Step 5 — Owner Authorization</span>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#dce4dc] bg-white p-3.5 text-xs transition hover:bg-[#fafbfa]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#34a853]"
            />
            <span className="font-semibold text-[#17221b] leading-relaxed">
              I confirm that these are the inheritance instructions I want associated with my vault.
              I retain sole authority to deposit crypto, seal browser secrets, customize asset rules, and veto false recoveries.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#718077]">
              Next: Deposit crypto and seal sensitive passwords in your browser.
            </span>
            <button
              type="button"
              disabled={!confirmed}
              onClick={handleConfirmAndContinue}
              className="rounded-lg bg-[#a3e635] px-6 py-2.5 text-xs font-bold text-[#17221b] shadow-sm transition hover:brightness-95 disabled:opacity-40"
            >
              Confirm & Continue to Asset Setup →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
