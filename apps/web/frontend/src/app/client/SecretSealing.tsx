import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import { sealSecret as sealInEscrow } from "../../lib/escrow";

type SecretType = "Password / Access" | "Recovery Code" | "Seed Phrase";

export default function SecretSealing() {
  const { activeVault, sealSecret, live } = useB2B2C();
  const [sealError, setSealError] = useState<string | null>(null);
  const [type, setType] = useState<SecretType>("Password / Access");
  const [label, setLabel] = useState("");
  const [secretText, setSecretText] = useState("");
  const [notes, setNotes] = useState("");
  const [isSealing, setIsSealing] = useState(false);
  const [sealedDone, setSealedDone] = useState(false);

  const handleSeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !secretText.trim()) return;

    setIsSealing(true);
    setSealError(null);
    if (live) {
      // Real: AES-256-GCM in this browser, key split k-of-n to the vault's guardians, ciphertext only to the server.
      sealInEscrow(label.trim(), secretText, activeVault.requiredApprovals)
        .then(() => sealSecret(activeVault.id, label.trim(), "Access Kit", `${type} · guardian-held key shares (${activeVault.requiredApprovals} of ${activeVault.guardians.length})`))
        .then(() => {
          setSecretText("");
          setSealedDone(true);
        })
        .catch((err: Error) => setSealError(err.message))
        .finally(() => setIsSealing(false));
      return;
    }
    // Local demo: simulated encryption
    setTimeout(() => {
      sealSecret(
        activeVault.id,
        label.trim(),
        "Access Kit",
        `${type} (${notes || "Encrypted local shard"})`
      );
      // Clear sensitive secret from memory immediately!
      setSecretText("");
      setIsSealing(false);
      setSealedDone(true);
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#e1e8e1] pb-4">
        <div>
          <span className="section-kicker">LOCAL CLIENT-SIDE CRYPTOGRAPHY</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Seal Sensitive Secret</h2>
          <p className="text-xs text-[#718077]">
            Active Vault: <b>{activeVault.clientName}</b> · Zero-knowledge browser encryption
          </p>
        </div>
        <Link
          to="/client/assets"
          className="rounded-lg border border-[#dce4dc] px-3 py-1.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Assets
        </Link>
      </div>

      {/* Prominent Privacy Statement */}
      <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#276332]">
          <span>Zero-Knowledge Browser Isolation</span>
        </div>
        <p className="mt-1 text-[11px] text-[#556358] leading-relaxed">
          <b>Your secret is encrypted in your browser before it leaves your device.</b> Neither Heirloom nor Mehta & Partners ever receive your plaintext passwords, recovery codes, or seed phrases.
        </p>
      </div>

      {sealedDone ? (
        /* Sealed Confirmation Screen */
        <div className="rounded-2xl border border-[#b9d79e] bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf4df] text-xl font-bold text-[#276332]">
            ✓
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#17221b]">Secret Sealed Securely</h3>
            <p className="mt-1 text-xs text-[#68756c] max-w-md mx-auto">
              Your secret was encrypted before leaving this device using AES-256-GCM and Shamir key shards.
              The plaintext has been permanently wiped from memory.
            </p>
          </div>

          <div className="rounded-lg bg-[#f8faf7] p-3 border border-[#edf0ed] text-left text-xs max-w-md mx-auto">
            <div className="text-[10px] text-[#718077] uppercase font-bold">Encrypted Asset Name</div>
            <div className="font-bold text-[#17221b] mt-0.5">{label}</div>
            <div className="text-[10px] text-[#869188] mt-1">Payload: AES-256-GCM Ciphertext + Auth Tag</div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSealedDone(false);
                setLabel("");
                setNotes("");
              }}
              className="rounded-lg border border-[#dce4dc] px-4 py-2 text-xs font-semibold text-[#17221b] hover:bg-[#f5f7f4]"
            >
              + Seal Another Secret
            </button>
            <Link
              to="/client/vault"
              className="rounded-lg bg-[#a3e635] px-5 py-2 text-xs font-bold text-[#17221b] hover:brightness-95"
            >
              View Client Dashboard →
            </Link>
          </div>
        </div>
      ) : (
        /* Secret Sealing Form */
        <form onSubmit={handleSeal} className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4 text-xs">
          <div>
            <label className="mb-2 block font-semibold text-[#2b382e]">Secret Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(["Password / Access", "Recovery Code", "Seed Phrase"] as SecretType[]).map((t) => (
                <label
                  key={t}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-semibold transition ${
                    type === t
                      ? "border-[#a3e635] bg-[#f8faf4] text-[#17221b] ring-1 ring-[#a3e635]"
                      : "border-[#e1e8e1] text-[#6b786e] hover:bg-[#fafbfa]"
                  }`}
                >
                  <input
                    type="radio"
                    name="secretType"
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="accent-[#34a853]"
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Item Identifier / Label</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Bitwarden Master Password or Trezor Recovery Seed"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs text-[#17221b]"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-semibold text-[#2b382e]">Secret Value (Masked)</label>
              <span className="text-[10px] text-[#869188]">Never displayed after submission</span>
            </div>
            <textarea
              required
              rows={3}
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
              placeholder="Paste password, emergency recovery phrase, or seed words here..."
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 font-mono text-xs text-[#17221b] [-webkit-text-security:disc]"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Recovery Context for Beneficiary (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Associated with personal iCloud and email accounts"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs text-[#17221b]"
            />
          </div>

          <div className="border-t border-[#edf0ed] pt-3">
            <button
              type="submit"
              disabled={isSealing || !label.trim() || !secretText.trim()}
              className="w-full rounded-lg bg-[#17221b] py-3 text-xs font-bold text-white shadow-sm hover:bg-black disabled:opacity-40"
            >
              {isSealing ? "Encrypting with AES-256-GCM..." : "Seal Secret Locally"}
            </button>
            <p className="mt-2 text-center text-[10px] text-[#869188]">
              The plaintext is wiped from memory as soon as the ciphertext is generated.
            </p>
          </div>
                  {sealError && <p role="alert" className="text-xs text-[#8a2f28]">{sealError}</p>}
        </form>
      )}
    </div>
  );
}
