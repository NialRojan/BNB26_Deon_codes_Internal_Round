import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

export default function DocumentVerification() {
  const { vaults, verifyDeathCertificate, submitDeathCertificate, lawFirm, live } = useB2B2C();
  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    vaults.find((v) => v.deathCertificateStatus === "Pending")?.id || vaults[0].id
  );
  const [heirUploadVaultId, setHeirUploadVaultId] = useState<string>(vaults[0].id);
  const [uploadedFileName, setUploadedFileName] = useState("death_certificate_municipal_authority.pdf");
  const [uploaderName, setUploaderName] = useState("Arjun Sharma (Legal Heir / Son)");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  const currentVault = vaults.find((v) => v.id === selectedVaultId) || vaults[0];

  const handleSimulateHeirUpload = (e: React.FormEvent) => {
    e.preventDefault();
    submitDeathCertificate(heirUploadVaultId, uploadedFileName, uploaderName);
    setUploadSuccess(true);
    setSelectedVaultId(heirUploadVaultId);
    setTimeout(() => setUploadSuccess(false), 2500);
  };

  const handleAction = async (approve: boolean) => {
    const ok = await (verifyDeathCertificate(currentVault.id, approve) as unknown as Promise<boolean | void>);
    if (ok === false) {
      setVerificationFeedback(live?.lastError() ?? "Review failed.");
      return;
    }
    setVerificationFeedback(
      approve
        ? "Document successfully verified by Mehta & Partners. On-chain status updated."
        : "Document rejected. Heir notified to provide attested certified copy."
    );
    setTimeout(() => setVerificationFeedback(null), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">FIDUCIARY EVIDENCE DESK</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Death Certificate Verification</h2>
          <p className="text-xs text-[#718077]">
            Fiduciary lawyer review of submitted probate certificates and evidence documents.
          </p>
        </div>
        <Link
          to="/lawyer"
          className="rounded-lg border border-[#dce4dc] px-3.5 py-1.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Lawyer Overview
        </Link>
      </div>

      {/* Transparent Disclaimer Banner */}
      <div className="rounded-xl border border-[#dce4dc] bg-[#f8faf7] p-4 text-xs text-[#4b5563]">
        <div className="flex items-center gap-2 font-bold text-[#17221b]">
          <span>⚖️</span>
          <span>Institutional Verification Standard</span>
        </div>
        <p className="mt-1 text-[11px] text-[#68756c] leading-relaxed">
          Heirloom provides cryptographic custody and workflow authorization. Document inspection is performed by qualified advocates at <b>{lawFirm.name}</b>. Heirloom does not claim automated government API verification.
        </p>
      </div>

      {/* Two Column Layout: Verification Panel & Heir Upload Simulator */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Verification Queue */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#edf0ed] pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#718077]">SELECTED DOSSIER</span>
                <h3 className="text-base font-bold text-[#17221b]">{currentVault.clientName}</h3>
                <span className="text-[11px] text-[#718077]">Vault: {currentVault.vaultAddress.slice(0, 12)}...</span>
              </div>

              {/* Vault Switcher */}
              <select
                value={selectedVaultId}
                onChange={(e) => setSelectedVaultId(e.target.value)}
                className="rounded-lg border border-[#dce4dc] px-2.5 py-1.5 text-xs font-bold"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.clientName} ({v.deathCertificateStatus})
                  </option>
                ))}
              </select>
            </div>

            {/* Document Details Card */}
            <div className="rounded-xl border border-[#e1e8e1] p-4 text-xs space-y-3 bg-[#fafbfa]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#17221b]">
                  📄 {currentVault.deathCertificateUrl || "death_certificate_rahul_sharma.pdf"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    currentVault.deathCertificateStatus === "Verified"
                      ? "bg-green-100 text-green-800"
                      : currentVault.deathCertificateStatus === "Pending"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {currentVault.deathCertificateStatus === "Verified"
                    ? "Verified ✓"
                    : currentVault.deathCertificateStatus === "Pending"
                    ? "Pending Lawyer Verification"
                    : "No Document Submitted"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] border-t border-[#edf0ed]">
                <div>
                  <span className="text-[#718077]">Uploaded By:</span>
                  <div className="font-semibold text-[#17221b]">
                    {currentVault.deathCertUploadedBy || "Authorized Family Heir"}
                  </div>
                </div>
                <div>
                  <span className="text-[#718077]">Submission Date:</span>
                  <div className="font-semibold text-[#17221b]">
                    {currentVault.deathCertUploadedAt || "Oct 3, 2026"}
                  </div>
                </div>
                <div>
                  <span className="text-[#718077]">Authority seal:</span>
                  <div className="font-semibold text-[#17221b]">Municipal Corporation / Registrar of Births & Deaths</div>
                </div>
                <div>
                  <span className="text-[#718077]">Fiduciary Reviewer:</span>
                  <div className="font-semibold text-[#17221b]">{lawFirm.loggedLawyer}</div>
                </div>
              </div>
            </div>

            {/* Verification Status Alerts */}
            {verificationFeedback && (
              <div className="rounded-lg bg-[#eaf4df] p-3 text-xs font-bold text-[#276332]">
                {verificationFeedback}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-3">
              <span className="text-[11px] text-[#718077]">
                Law firm decision is immutably logged to the vault audit trail.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(false)}
                  className="rounded-lg border border-[#ef4444] px-4 py-2 text-xs font-bold text-[#b91c1c] hover:bg-[#fef2f2]"
                >
                  ✕ Reject Document
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(true)}
                  className="rounded-lg bg-[#276332] px-5 py-2 text-xs font-bold text-white hover:bg-[#1e4e26]"
                >
                  ✓ Verify Document
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Heir Upload Flow (Simulation) */}
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm space-y-4">
          <div className="border-b border-[#edf0ed] pb-2">
            <span className="text-[10px] uppercase font-bold text-[#718077]">HEIR RECOVERY PORTAL</span>
            <h3 className="text-base font-bold text-[#17221b]">Upload Death Certificate</h3>
            <p className="text-xs text-[#718077]">
              Demonstrates how an authorized heir initiates recovery by submitting death certificates.
            </p>
          </div>

          <form onSubmit={handleSimulateHeirUpload} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-[#2b382e] block mb-1">Target Client Vault</label>
              <select
                value={heirUploadVaultId}
                onChange={(e) => setHeirUploadVaultId(e.target.value)}
                className="w-full rounded-lg border border-[#dce4dc] px-2.5 py-1.5"
              >
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.clientName} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#2b382e] block mb-1">Uploader Name & Relation</label>
              <input
                type="text"
                value={uploaderName}
                onChange={(e) => setUploaderName(e.target.value)}
                className="w-full rounded-lg border border-[#dce4dc] px-2.5 py-1.5"
              />
            </div>

            <div>
              <label className="font-semibold text-[#2b382e] block mb-1">Select File (PDF / Scanned Copy)</label>
              <input
                type="text"
                value={uploadedFileName}
                onChange={(e) => setUploadedFileName(e.target.value)}
                className="w-full rounded-lg border border-[#dce4dc] px-2.5 py-1.5 font-mono text-[11px]"
              />
            </div>

            {uploadSuccess && (
              <div className="rounded-lg bg-[#eaf4df] p-2 text-center font-bold text-[#276332]">
                ✓ Document Submitted for Verification!
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-[#17221b] py-2.5 font-bold text-white hover:bg-black"
            >
              Submit Evidence Document →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
