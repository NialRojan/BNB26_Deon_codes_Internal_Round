import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import type { AssetRecord } from "../../data/mockData";

export default function AssetOnboarding() {
  const { activeVault, addClientAsset } = useB2B2C();
  const [category, setCategory] = useState<AssetRecord["category"]>("Crypto");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [institution, setInstitution] = useState("");
  const [valueOrSize, setValueOrSize] = useState("");
  const [customRule, setCustomRule] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addClientAsset(activeVault.id, {
      category,
      name: name.trim(),
      detail: detail.trim() || `${category} registered by client`,
      institution: institution.trim() || undefined,
      valueOrSize: valueOrSize.trim() || undefined,
      customRule: customRule.trim() || undefined,
    });
    setName("");
    setDetail("");
    setInstitution("");
    setValueOrSize("");
    setCustomRule("");
  };

  const cryptoAssets = activeVault.assets.filter((a) => a.category === "Crypto");
  const accessAssets = activeVault.assets.filter((a) => a.category === "Access Kit");
  const legalAssets = activeVault.assets.filter((a) => a.category === "Legal / Asset Information");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">STEP 2 OF ONBOARDING</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Add Assets to Your Vault</h2>
          <p className="text-xs text-[#718077]">
            Active client vault: <b>{activeVault.clientName}</b> ({activeVault.vaultAddress.slice(0, 10)}...)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/client/deposit"
            className="rounded-lg bg-[#a3e635] px-3.5 py-2 text-xs font-bold text-[#17221b] hover:brightness-95"
          >
            Deposit Crypto →
          </Link>
          <Link
            to="/client/seal"
            className="rounded-lg bg-[#17221b] px-3.5 py-2 text-xs font-bold text-white hover:bg-black"
          >
            Seal Secret →
          </Link>
        </div>
      </div>

      {/* Three Asset Class Behavioral Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#276332]">Class 1 · Stage 3</span>
            <span className="text-base">🪙</span>
          </div>
          <h4 className="mt-1 font-bold text-[#17221b]">Crypto & Wallets</h4>
          <p className="mt-1 text-[11px] text-[#68756c]">
            <b>Released last</b>. Deposited directly from your personal wallet to vault smart contracts. Only the client can fund.
          </p>
          <div className="mt-3 font-semibold text-[#276332]">
            {cryptoAssets.length} assets registered
          </div>
        </div>

        <div className="rounded-xl border border-[#bae6fd] bg-[#f0f9ff] p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#0369a1]">Class 2 · Stage 2</span>
            <span className="text-base">🔐</span>
          </div>
          <h4 className="mt-1 font-bold text-[#17221b]">Access Kit & Passwords</h4>
          <p className="mt-1 text-[11px] text-[#68756c]">
            <b>Encrypted in browser</b>. Master passwords, 2FA codes, seed phrases. Released to heirs after guardian threshold.
          </p>
          <div className="mt-3 font-semibold text-[#0369a1]">
            {accessAssets.length} secrets sealed
          </div>
        </div>

        <div className="rounded-xl border border-[#fde3a7] bg-[#fffbf0] p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#9a6700]">Class 3 · Stage 1</span>
            <span className="text-base">📑</span>
          </div>
          <h4 className="mt-1 font-bold text-[#17221b]">Legal & Bank Dossier</h4>
          <p className="mt-1 text-[11px] text-[#68756c]">
            <b>Released first to executor</b>. Bank folios, demat accounts, deeds. Holds no passwords, guides legal probate claims.
          </p>
          <div className="mt-3 font-semibold text-[#9a6700]">
            {legalAssets.length} accounts recorded
          </div>
        </div>
      </div>

      {/* Add Asset Form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
        <div className="border-b border-[#edf0ed] pb-3">
          <h3 className="text-base font-bold text-[#17221b]">Register an Asset Metadata Record</h3>
          <p className="text-xs text-[#718077]">
            Provide information for your heirs or executor. Note: For actual crypto deposits and client-side password sealing, use the dedicated tools above.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Asset Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetRecord["category"])}
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 font-medium"
            >
              <option value="Crypto">Crypto (ETH, BTC, Tokens, NFTs)</option>
              <option value="Access Kit">Access Kit (Password Manager, Cloud Recovery)</option>
              <option value="Legal / Asset Information">Legal / Asset Information (Bank, Demat, Insurance)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Asset Name / Title</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Wealth Demat Account or Ledger ETH"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Institution / Platform (Optional)</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Zerodha, HDFC Bank, Trezor"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#2b382e]">Estimated Value / Balance (Optional)</label>
            <input
              type="text"
              value={valueOrSize}
              onChange={(e) => setValueOrSize(e.target.value)}
              placeholder="e.g. 15.0 ETH or INR 45 Lakhs"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block font-semibold text-[#2b382e]">Account Details / Notes for Nominee</label>
            <textarea
              rows={2}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Folio numbers, branch location, where documents are stored. Do not paste passwords here!"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block font-semibold text-[#2b382e]">Custom Release Rule (Optional)</label>
            <input
              type="text"
              value={customRule}
              onChange={(e) => setCustomRule(e.target.value)}
              placeholder="e.g. 70% to Asha, 30% to Arjun at age 21"
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[#17221b] px-5 py-2 text-xs font-bold text-white hover:bg-black"
          >
            + Add Asset Record
          </button>
        </div>
      </form>

      {/* Asset Inventory List */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#edf0ed] pb-3">
          <h3 className="text-base font-bold text-[#17221b]">Current Vault Inventory ({activeVault.assets.length})</h3>
          <Link
            to="/client/customize"
            className="text-xs font-semibold text-[#3b7043] hover:underline"
          >
            Configure Per-Asset Heir Rules ↗
          </Link>
        </div>

        <div className="space-y-3">
          {activeVault.assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e1e8e1] p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <b className="text-sm text-[#17221b]">{asset.name}</b>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold ${
                      asset.category === "Crypto"
                        ? "bg-[#eaf4df] text-[#276332]"
                        : asset.category === "Access Kit"
                        ? "bg-[#e0f2fe] text-[#0369a1]"
                        : "bg-[#fff7e6] text-[#9a6700]"
                    }`}
                  >
                    {asset.category}
                  </span>
                  {asset.sealed && (
                    <span className="rounded bg-[#f0f4ef] px-1.5 py-0.5 text-[9px] font-bold text-[#34a853]">
                      Sealed In Browser ✓
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-[#68756c]">{asset.detail}</div>
                {asset.customRule && (
                  <div className="mt-1 font-semibold text-[10px] text-[#276332]">
                    Rule: {asset.customRule}
                  </div>
                )}
              </div>

              <div className="text-right">
                {asset.valueOrSize && (
                  <div className="font-bold text-sm text-[#17221b]">{asset.valueOrSize}</div>
                )}
                {asset.institution && (
                  <span className="text-[10px] text-[#869188]">{asset.institution}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
