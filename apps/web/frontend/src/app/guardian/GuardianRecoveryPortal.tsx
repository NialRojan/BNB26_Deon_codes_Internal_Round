import { useState } from "react";
import { useB2B2C } from "../../lib/b2b2cStore";
import { useVault } from "../../lib/vault";
import { GuardianEscrowCard } from "../../components/EscrowPanels";
import type { ClientVault } from "../../data/mockData";

type VoteTxState = "idle" | "signing" | "submitting" | "confirmed";

export default function GuardianRecoveryPortal() {
  const { vaults, submitGuardianAttestation, live, setActiveVaultId } = useB2B2C();
  const { chain } = useVault();
  const [voteError, setVoteError] = useState<string | null>(null);
  const [selectedVault, setSelectedVault] = useState<ClientVault | null>(null);
  const [attestationVote, setAttestationVote] = useState<"approve" | "reject" | null>(null);
  const [voteTxState, setVoteTxState] = useState<VoteTxState>("idle");
  const [attestationReason, setAttestationReason] = useState("I have reviewed the evidence and attest to the owner's passing.");

  // Filter vaults in Watch, Recovery Pending, or Veto Window
  const activeRequests = vaults.filter(
    (v) => v.status === "RECOVERY PENDING" || v.status === "VETO WINDOW" || v.status === "WATCH"
  );

  const handleOpenReview = (vault: ClientVault) => {
    if (live) setActiveVaultId(vault.id);
    setVoteError(null);
    setSelectedVault(vault);
    setAttestationVote(null);
    setVoteTxState("idle");
  };

  const handleExecuteAttestation = async () => {
    if (!selectedVault || !attestationVote) return;
    if (live) {
      // Real: the connected guardian signs (free); the relayer submits and pays gas.
      const me = selectedVault.guardians.find((g) => g.wallet.toLowerCase() === chain.account?.toLowerCase());
      if (!me) return setVoteError("The connected wallet is not a guardian of this vault. Switch account in MetaMask.");
      setVoteError(null);
      setVoteTxState("signing");
      const ok = await (submitGuardianAttestation(selectedVault.id, me.id, attestationVote === "approve") as unknown as Promise<boolean>);
      if (!ok) {
        setVoteError(live.lastError());
        setVoteTxState("idle");
      } else setVoteTxState("confirmed");
      return;
    }
    setVoteTxState("signing");
    setTimeout(() => {
      setVoteTxState("submitting");
      setTimeout(() => {
        setVoteTxState("confirmed");
        // Submit attestation for guardian g1 or g2
        const targetGuardian = selectedVault.guardians[1] || selectedVault.guardians[0];
        submitGuardianAttestation(selectedVault.id, targetGuardian.id, attestationVote === "approve");
      }, 2000);
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Banner */}
      <section className="welcome-card" style={{ background: "#17232e", minHeight: "170px" }}>
        <div className="welcome-copy" style={{ maxWidth: "680px", padding: "24px 30px" }}>
          <span className="welcome-kicker" style={{ color: "#8fd3ff" }}>
            FIDUCIARY GUARDIAN CONSOLE · GASLESS ATTESTATION
          </span>
          <h2 style={{ fontSize: "24px", margin: "6px 0 4px" }}>
            Guardian Recovery Portal
          </h2>
          <p style={{ fontSize: "12px", color: "#c8dceb", maxWidth: "560px", lineHeight: "1.5" }}>
            You hold a cryptographic key share for trust-minimized estate vaults. Your role is to review submitted evidence and vote independently. Attestation transactions are 100% gasless.
          </p>
          <div className="welcome-actions" style={{ marginTop: "12px" }}>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              {activeRequests.length} Pending Fiduciary Inquiries
            </span>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true" style={{ opacity: 0.5 }}>
          <div className="halo" />
          <div className="shield" style={{ background: "#8fd3ff" }}></div>
        </div>
      </section>

      {live && (
        <div className="space-y-3">
          <p className="text-xs text-[#718077]">
            {chain.account ? `Connected guardian wallet ${chain.account.slice(0, 6)}…${chain.account.slice(-4)}` : "Connect your guardian wallet (top right)."} · Vault {chain.vaultAddress.slice(0, 6)}…{chain.vaultAddress.slice(-4)}
          </p>
          <GuardianEscrowCard />
        </div>
      )}
      {voteError && <p role="alert" className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs text-[#8a2f28]">{voteError}</p>}

      {/* Pending Recovery Requests Header */}
      <div>
        <span className="section-kicker">INDEPENDENT ATTESTATION QUEUE</span>
        <h3 className="text-xl font-bold text-[#17221b]">Pending Recovery Requests</h3>
        <p className="text-xs text-[#718077]">
          Each card represents an active recovery initiated by heirs or missed check-in heartbeat.
        </p>
      </div>

      {activeRequests.length === 0 ? (
        <div className="rounded-2xl border border-[#e1e8e1] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f4ef] text-xl font-bold text-[#276332]">
            ✓
          </div>
          <h4 className="mt-3 text-base font-bold text-[#17221b]">No Pending Recovery Requests</h4>
          <p className="mt-1 text-xs text-[#718077]">
            All monitored client vaults are in healthy ACTIVE status. You will receive an alert if an attestation is requested.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {activeRequests.map((vault) => (
            <div
              key={vault.id}
              className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-4 hover:border-[#a3e635] transition"
            >
              <div className="flex items-start justify-between border-b border-[#edf0ed] pb-3">
                <div>
                  <h4 className="font-bold text-base text-[#17221b]">{vault.clientName}</h4>
                  <div className="text-[11px] text-[#718077]">{vault.clientEmail}</div>
                  <div className="text-[10px] font-mono text-[#869188] mt-0.5">
                    Vault: {vault.vaultAddress.slice(0, 10)}...{vault.vaultAddress.slice(-6)}
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: vault.status === "VETO WINDOW" ? "#fef2f2" : "#fff1eb",
                    color: vault.status === "VETO WINDOW" ? "#b91c1c" : "#b43b17",
                  }}
                >
                  {vault.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#718077]">Evidence Status:</span>
                  <b className="text-[#17221b]">
                    {vault.deathCertificateStatus === "Verified"
                      ? "Death Certificate Verified ✓"
                      : vault.deathCertificateStatus === "Pending"
                      ? "Death Certificate Submitted"
                      : "Heartbeat Inactivity Alert"}
                  </b>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#718077]">Guardian Approvals:</span>
                  <b className="text-[#17221b]">
                    {vault.guardianAttestationsCount} / {vault.requiredApprovals} Required
                  </b>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#718077]">Time Remaining:</span>
                  <b className="text-[#b43b17]">
                    {vault.status === "VETO WINDOW" ? `${vault.vetoTimeRemainingHours || 24}h Veto Window` : "48h Guardian Response Target"}
                  </b>
                </div>

                <div className="rounded bg-[#f8faf7] p-2 text-[11px] text-[#477b4d]">
                  Status: {vault.recoveryStatusDetail}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenReview(vault)}
                  className="w-full rounded-lg bg-[#17221b] py-2 text-center text-xs font-bold text-white hover:bg-black"
                >
                  Review Recovery & Submit Vote →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guardian Review & Gasless Attestation Modal */}
      {selectedVault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[#dce4dc] bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between border-b border-[#edf0ed] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0369a1]">
                  FIDUCIARY ATTESTATION REVIEW
                </span>
                <h3 className="text-xl font-bold text-[#17221b]">{selectedVault.clientName}</h3>
                <p className="text-xs text-[#718077]">Recovery Request Dossier</p>
              </div>
              <button
                onClick={() => setSelectedVault(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Evidence & Timeline Summary */}
            <div className="rounded-xl border border-[#e1e8e1] bg-[#f8faf7] p-4 text-xs space-y-2">
              <h4 className="font-bold text-[#17221b]">Submitted Evidence</h4>
              <div className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-[#e1e8e1]">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="font-bold text-[#17221b]">
                      {selectedVault.deathCertificateUrl || "death_certificate_document.pdf"}
                    </div>
                    <span className="text-[10px] text-[#718077]">
                      Submitted by: {selectedVault.deathCertUploadedBy || "Authorized Family Heir"}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 font-bold text-[10px] ${
                    selectedVault.deathCertificateStatus === "Verified"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedVault.deathCertificateStatus === "Verified" ? "Lawyer Verified ✓" : "Pending Verification"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-[#68756c]">
                <div>Guardian Quorum: <b>{selectedVault.guardianAttestationsCount} / {selectedVault.requiredApprovals} Approvals</b></div>
                <div>Executor: <b>{selectedVault.executor}</b></div>
              </div>
            </div>

            {/* Gasless Vote Notice */}
            <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-3.5 text-xs">
              <div className="font-bold text-[#276332]">Gasless Guardian Vote Enabled</div>
              <p className="mt-1 text-[11px] text-[#556358] leading-relaxed">
                <b>You do not need ETH for this action.</b> Your approval will be cryptographically signed by your device and submitted on your behalf by Heirloom's fiduciary relayer.
              </p>
            </div>

            {voteTxState === "confirmed" ? (
              <div className="rounded-xl bg-[#eaf4df] p-6 text-center text-xs space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#34a853] text-white font-bold text-lg">
                  ✓
                </div>
                <h4 className="font-bold text-sm text-[#276332]">Attestation Submitted Successfully</h4>
                <p className="text-[#556358]">
                  Your decision has been recorded on the recovery contract. If the threshold is satisfied, the owner veto window commences.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedVault(null)}
                    className="rounded-lg bg-[#17221b] px-4 py-2 text-xs font-bold text-white hover:bg-black"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Vote Selection & Execution */
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-[#17221b] block mb-2">Your Independent Attestation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3.5 font-bold transition ${
                        attestationVote === "approve"
                          ? "border-[#34a853] bg-[#f0f9f1] text-[#276332] ring-1 ring-[#34a853]"
                          : "border-[#e1e8e1] hover:bg-[#fafbfa]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="vote"
                        checked={attestationVote === "approve"}
                        onChange={() => setAttestationVote("approve")}
                        className="accent-[#34a853]"
                      />
                      <span>✓ Approve / Attest Recovery</span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3.5 font-bold transition ${
                        attestationVote === "reject"
                          ? "border-[#ef4444] bg-[#fef2f2] text-[#b91c1c] ring-1 ring-[#ef4444]"
                          : "border-[#e1e8e1] hover:bg-[#fafbfa]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="vote"
                        checked={attestationVote === "reject"}
                        onChange={() => setAttestationVote("reject")}
                        className="accent-[#ef4444]"
                      />
                      <span>✕ Reject Attestation</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#2b382e] block mb-1">Attestation Statement</label>
                  <textarea
                    rows={2}
                    value={attestationReason}
                    onChange={(e) => setAttestationReason(e.target.value)}
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs"
                  />
                </div>

                {/* Simulated States Bar */}
                {voteTxState !== "idle" && (
                  <div className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] p-3 text-xs text-[#0369a1] space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      {voteTxState === "signing" && <span>Signing Guardian Key Share EIP-712...</span>}
                      {voteTxState === "submitting" && <span>Submitting Gasless Transaction to Relayer...</span>}
                    </div>
                    <p className="text-[11px]">
                      {voteTxState === "signing"
                        ? "Browser verifying private key share locally."
                        : "Heirloom Relayer sponsoring gas fee and broadcasting attestation on-chain."}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-[#edf0ed] pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedVault(null)}
                    className="rounded-lg border border-[#dce4dc] px-3 py-2 font-semibold text-[#2b382e]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!attestationVote || voteTxState !== "idle"}
                    onClick={handleExecuteAttestation}
                    className="rounded-lg bg-[#17221b] px-5 py-2 font-bold text-white hover:bg-black disabled:opacity-40"
                  >
                    {voteTxState === "signing"
                      ? "Signing..."
                      : voteTxState === "submitting"
                      ? "Submitting..."
                      : "Confirm Attestation (Gasless) →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
