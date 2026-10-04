import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

export default function PerAssetCustomization() {
  const { activeVault, updateAssetRule } = useB2B2C();
  const [selectedAssetId, setSelectedAssetId] = useState<string>(activeVault.assets[0]?.id || "");
  const selectedAsset = activeVault.assets.find((a) => a.id === selectedAssetId) || activeVault.assets[0];

  // Customization controls
  const [mode, setMode] = useState<"percentage" | "all" | "nft" | "staged">("percentage");
  const [heirSplits, setHeirSplits] = useState<Record<string, number>>({
    [activeVault.heirs[0]?.id || "h1"]: 70,
    [activeVault.heirs[1]?.id || "h2"]: 30,
  });
  const [unlockCondition, setUnlockCondition] = useState("Age 21 (Nov 15, 2028)");
  const [stagedInstallments, setStagedInstallments] = useState(10);
  const [stagedInterval, setStagedInterval] = useState("1 Year");
  const [assignedNftHeir, setAssignedNftHeir] = useState(activeVault.heirs[2]?.id || activeVault.heirs[0]?.id || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleDistributeToAll = () => {
    setMode("all");
    const count = activeVault.heirs.length;
    const equalShare = Math.floor(100 / count);
    const remainder = 100 - equalShare * count;
    const splits: Record<string, number> = {};
    activeVault.heirs.forEach((h, idx) => {
      splits[h.id] = idx === 0 ? equalShare + remainder : equalShare;
    });
    setHeirSplits(splits);
  };

  const handleSaveRule = () => {
    let ruleText = "";
    if (mode === "nft") {
      const heir = activeVault.heirs.find((h) => h.id === assignedNftHeir);
      ruleText = `NFT Assigned 100% to ${heir?.name || "Designated Heir"}`;
    } else if (mode === "all") {
      ruleText = `Distributed equally to all heirs (${activeVault.heirs.map((h) => h.name.split(" ")[0]).join(", ")})`;
    } else if (mode === "staged") {
      ruleText = `Staged Payout: ${Math.round(100 / stagedInstallments)}% every ${stagedInterval} (${stagedInstallments} installments). Unlock condition: ${unlockCondition}`;
    } else {
      const parts = activeVault.heirs
        .filter((h) => (heirSplits[h.id] || 0) > 0)
        .map((h) => `${h.name.split(" ")[0]} ${heirSplits[h.id]}%`);
      ruleText = `Custom Allocation: ${parts.join(", ")} · Unlock: ${unlockCondition}`;
    }

    updateAssetRule(activeVault.id, selectedAsset.id, ruleText);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">PHASE A PER-ASSET GRANULARITY</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Per-Asset Inheritance Customization</h2>
          <p className="text-xs text-[#718077]">
            Configure unique heir percentages, milestone unlock ages, staged payouts, and NFT assignments per asset.
          </p>
        </div>
        <Link
          to="/client/vault"
          className="rounded-lg border border-[#dce4dc] px-3.5 py-2 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Return to Vault
        </Link>
      </div>

      {/* Asset Selector Tabs */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#2b382e] uppercase tracking-wider">
          Select Asset to Configure:
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {activeVault.assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => {
                setSelectedAssetId(asset.id);
                if (asset.name.includes("NFT") || asset.name.includes("Punk")) {
                  setMode("nft");
                }
              }}
              className={`rounded-xl border p-3.5 text-left text-xs transition ${
                selectedAssetId === asset.id
                  ? "border-[#a3e635] bg-[#f8faf4] ring-2 ring-[#a3e635]"
                  : "border-[#e1e8e1] bg-white hover:bg-[#fafbfa]"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-[#17221b] truncate">{asset.name}</span>
                <span className="text-[9px] uppercase font-bold text-[#477b4d]">{asset.category}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#68756c] truncate">{asset.detail}</p>
              {asset.customRule && (
                <div className="mt-1.5 text-[10px] text-[#276332] font-semibold truncate">
                  Active: {asset.customRule}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Panel for Selected Asset */}
      {selectedAsset && (
        <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#edf0ed] pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#718077]">CUSTOMIZING POLICY FOR</span>
              <h3 className="text-lg font-bold text-[#17221b]">{selectedAsset.name}</h3>
              <p className="text-xs text-[#68756c]">{selectedAsset.detail}</p>
            </div>
            <button
              type="button"
              onClick={handleDistributeToAll}
              className="rounded-lg border border-[#a3e635] bg-[#f8faf4] px-3 py-1.5 text-xs font-bold text-[#276332] hover:bg-[#eaf4df]"
            >
              Distribute Equally to All Heirs
            </button>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs font-semibold">
            {[
              { id: "percentage", label: "Custom Heir Split" },
              { id: "all", label: "All Heirs Pro-Rata" },
              { id: "staged", label: "Staged Payouts" },
              { id: "nft", label: "Single Heir / NFT" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id as typeof mode)}
                className={`rounded-lg border p-2.5 text-center transition ${
                  mode === tab.id
                    ? "border-[#17221b] bg-[#17221b] text-white"
                    : "border-[#dce4dc] text-[#6b786e] hover:bg-[#f5f7f4]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mode 1: Percentage Split */}
          {mode === "percentage" && (
            <div className="space-y-4 rounded-xl border border-[#edf0ed] bg-[#fafbfa] p-4 text-xs">
              <h4 className="font-bold text-[#17221b]">Custom Beneficiary Split for {selectedAsset.name}</h4>
              <div className="space-y-3">
                {activeVault.heirs.map((heir) => (
                  <div key={heir.id} className="flex items-center justify-between rounded-lg bg-white p-3 border border-[#e1e8e1]">
                    <div>
                      <b className="text-[#17221b]">{heir.name}</b> <span className="text-[#718077]">({heir.relationship})</span>
                      <div className="text-[10px] text-[#869188]">{heir.wallet}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={heirSplits[heir.id] || 0}
                        onChange={(e) =>
                          setHeirSplits({ ...heirSplits, [heir.id]: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-[#dce4dc] px-2 py-1 text-right font-bold text-xs"
                      />
                      <span className="font-bold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Distribute to All Heirs */}
          {mode === "all" && (
            <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-4 text-xs space-y-2">
              <h4 className="font-bold text-[#276332]">Equal Distribution Configured</h4>
              <p className="text-[11px] text-[#556358]">
                This asset will be split equally across all {activeVault.heirs.length} heirs upon release.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {activeVault.heirs.map((h) => (
                  <span key={h.id} className="rounded-full bg-white border border-[#b9d79e] px-3 py-1 font-semibold text-[#276332]">
                    {h.name}: {heirSplits[h.id] || Math.floor(100 / activeVault.heirs.length)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mode 3: Staged Payouts */}
          {mode === "staged" && (
            <div className="rounded-xl border border-[#edf0ed] bg-[#fafbfa] p-4 text-xs space-y-4">
              <h4 className="font-bold text-[#17221b]">Staged Installment Schedule</h4>
              <p className="text-[11px] text-[#718077]">
                Distribute payouts gradually rather than in a lump sum (e.g. 10% per year for 10 years).
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#2b382e] block mb-1">Number of Installments</label>
                  <select
                    value={stagedInstallments}
                    onChange={(e) => setStagedInstallments(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold"
                  >
                    <option value={4}>4 Installments (25% each)</option>
                    <option value={5}>5 Installments (20% each)</option>
                    <option value={10}>10 Installments (10% each)</option>
                    <option value={20}>20 Installments (5% each)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#2b382e] block mb-1">Payout Interval</label>
                  <select
                    value={stagedInterval}
                    onChange={(e) => setStagedInterval(e.target.value)}
                    className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-semibold"
                  >
                    <option value="6 Months">Every 6 Months</option>
                    <option value="1 Year">Every 1 Year (Annual)</option>
                    <option value="2 Years">Every 2 Years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Mode 4: NFT Assignment */}
          {mode === "nft" && (
            <div className="rounded-xl border border-[#edf0ed] bg-[#fafbfa] p-4 text-xs space-y-4">
              <h4 className="font-bold text-[#17221b]">Direct Collectible / NFT Assignment</h4>
              <p className="text-[11px] text-[#718077]">
                Non-fungible assets cannot be split by percentage and are transferred 100% to a single chosen heir.
              </p>
              <div>
                <label className="font-semibold text-[#2b382e] block mb-1">Assign Collectible To:</label>
                <select
                  value={assignedNftHeir}
                  onChange={(e) => setAssignedNftHeir(e.target.value)}
                  className="w-full rounded-lg border border-[#dce4dc] px-3 py-2 text-xs font-bold text-[#17221b]"
                >
                  {activeVault.heirs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.relationship}) — {h.wallet}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Milestone Unlock Date / Age Requirement */}
          <div className="rounded-xl border border-[#e1e8e1] p-4 text-xs space-y-2">
            <label className="font-bold text-[#17221b] block">Milestone Unlock Date / Heir Age Condition</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={unlockCondition}
                onChange={(e) => setUnlockCondition(e.target.value)}
                placeholder="e.g. Unlocks at 21st birthday or 2028-11-15"
                className="rounded-lg border border-[#dce4dc] px-3 py-2 text-xs"
              />
              <div className="flex items-center text-[11px] text-[#718077]">
                Smart contract enforces timelock until specified milestone timestamp.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-4">
            {savedSuccess ? (
              <span className="font-bold text-xs text-[#276332]">
                ✓ Custom inheritance rule saved for {selectedAsset.name}!
              </span>
            ) : (
              <span className="text-xs text-[#718077]">
                Rule will be signed client-side and saved to vault metadata.
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveRule}
              className="rounded-lg bg-[#a3e635] px-5 py-2.5 text-xs font-bold text-[#17221b] shadow-sm hover:brightness-95"
            >
              Save Custom Asset Rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
