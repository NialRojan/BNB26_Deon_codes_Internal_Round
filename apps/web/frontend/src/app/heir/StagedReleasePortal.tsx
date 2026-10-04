import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";
import { useVault } from "../../lib/vault";
import PartyRoster from "../../components/PartyRoster";

interface StageCard {
  stage: number;
  name: string;
  category: string;
  status: "Released" | "Timelocked" | "Locked";
  statusColor: string;
  beneficiary: string;
  condition: string;
  countdown?: string;
  items: { title: string; detail: string; actionText?: string }[];
}

export default function StagedReleasePortal() {
  const { activeVault, vaults, setActiveVaultId } = useB2B2C();
  const [selectedVaultId, setSelectedVaultId] = useState(
    vaults.find((v) => v.status === "EXECUTED")?.id || activeVault.id
  );
  const [downloadedPacket, setDownloadedPacket] = useState(false);
  const { chain } = useVault();

  const vault = vaults.find((v) => v.id === selectedVaultId) || activeVault;
  const isExecuted = vault.status === "EXECUTED";

  const stages: StageCard[] = [
    {
      stage: 1,
      name: "Stage 1 — Legal Packet",
      category: "Legal Dossier & Bank Folios",
      status: isExecuted ? "Released" : "Locked",
      statusColor: isExecuted ? "bg-[#dcfce7] text-[#166534]" : "bg-gray-100 text-gray-600",
      beneficiary: `Executor: ${vault.executor}`,
      condition: "Immediate release upon Digital Will execution by Law Firm",
      countdown: isExecuted ? "Released on Oct 1, 2026 ✓" : "Awaiting Will Execution",
      items: [
        { title: "Bank Account Transmission Dossier", detail: "HDFC Private Banking & Demat Folios for probate claim", actionText: "Download Legal Packet" },
        { title: "Real Estate & Deed Title Copies", detail: "Bandra Property Registration Certificate & Mutation Records", actionText: "Download Dossier" },
      ],
    },
    {
      stage: 2,
      name: "Stage 2 — Access Kit",
      category: "Password Manager & Cloud Recovery",
      status: isExecuted ? "Timelocked" : "Locked",
      statusColor: isExecuted ? "bg-[#e0f2fe] text-[#0369a1]" : "bg-gray-100 text-gray-600",
      beneficiary: `Designated Heirs: ${vault.heirs.map((h) => h.name.split(" ")[0]).join(", ")}`,
      condition: "7-Day safety timelock following Stage 1 legal execution",
      countdown: isExecuted ? "Unlocks in 4 days, 16 hours" : "Locked",
      items: [
        { title: "Password Manager Emergency Recovery", detail: "Encrypted browser-side key shards · Decrypted on heir devices" },
        { title: "Primary Email & 2FA Recovery Tokens", detail: "Emergency cloud keys for accounts management" },
      ],
    },
    {
      stage: 3,
      name: "Stage 3 — Crypto & Digital Assets",
      category: "Direct Wallet Custody & NFTs",
      status: isExecuted ? "Timelocked" : "Locked",
      statusColor: isExecuted ? "bg-[#fef3c7] text-[#92400e]" : "bg-gray-100 text-gray-600",
      beneficiary: "All Heirs per Custom Asset Rules",
      condition: "30-Day timelock + Milestone age triggers & installment schedules",
      countdown: isExecuted ? "Unlocks in 27 days · Staged payouts active" : "Locked",
      items: [
        { title: "Ethereum Vault Balance (14.5 ETH)", detail: "Custom Split: Asha 70%, Arjun 30% (Age 21 milestone rule)" },
        { title: "Bitcoin Cold Storage (1.25 BTC)", detail: "Distributed equally to all heirs" },
        { title: "CryptoPunk #1234 Collectible", detail: "Transfers 100% to Diya Sharma" },
      ],
    },
  ];

  const handleDownloadPacket = () => {
    setDownloadedPacket(true);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            vaultAddress: vault.vaultAddress,
            clientName: vault.clientName,
            executor: vault.executor,
            stage: "Stage 1 Legal Packet",
            generated: new Date().toISOString(),
            accounts: vault.assets.filter((a) => a.category === "Legal / Asset Information"),
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Heirloom-Legal-Packet-${vault.clientName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header & Vault Switcher */}
      <div className="flex flex-col gap-2 border-b border-[#e1e8e1] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="section-kicker">SEQUENTIAL ASSET TRANSMISSION</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Staged Release Architecture</h2>
          <p className="text-xs text-[#718077]">
            Materials are released sequentially across three distinct stages after legal execution.
          </p>
        </div>

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
                {v.clientName} ({v.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      <PartyRoster vault={vault} kind="heir" me={chain.account} />

      {/* Execution Context Banner */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#718077]">Active Dossier</span>
          <div className="font-bold text-sm text-[#17221b]">{vault.clientName}</div>
          <p className="text-[11px] text-[#68756c]">
            Status: <b>{vault.status}</b> · Executor: <b>{vault.executor}</b>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/recovery"
            className="rounded-lg border border-[#dce4dc] px-3 py-1.5 font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
          >
            View Recovery Timeline ↗
          </Link>
          {!isExecuted && (
            <Link
              to="/lawyer/execute"
              className="rounded-lg bg-[#0284c7] px-3.5 py-1.5 font-bold text-white hover:bg-[#0369a1]"
            >
              Go to Execution Desk →
            </Link>
          )}
        </div>
      </div>

      {/* Three Staged Release Cards */}
      <div className="space-y-4">
        {stages.map((stg) => (
          <div
            key={stg.stage}
            className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#edf0ed] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17221b] text-[11px] font-bold text-white">
                    0{stg.stage}
                  </span>
                  <h3 className="text-base font-bold text-[#17221b]">{stg.name}</h3>
                  <span className="text-xs text-[#718077]">({stg.category})</span>
                </div>
                <div className="mt-1 text-xs text-[#68756c]">
                  Beneficiary: <b>{stg.beneficiary}</b>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${stg.statusColor}`}>
                  {stg.status === "Released" ? "✓ Released" : stg.status === "Timelocked" ? "Timelocked" : "Gate Locked"}
                </span>
                {stg.countdown && (
                  <span className="rounded bg-[#f8faf7] border border-[#e1e8e1] px-2.5 py-1 text-[11px] font-mono text-[#2b382e]">
                    {stg.countdown}
                  </span>
                )}
              </div>
            </div>

            {/* Condition Info */}
            <div className="rounded-lg bg-[#f8faf7] p-2.5 text-xs text-[#477b4d] font-medium border border-[#edf0ed]">
              Gate condition: {stg.condition}
            </div>

            {/* Items inside this stage */}
            <div className="space-y-2">
              {stg.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e1e8e1] p-3 text-xs bg-[#fafbfa]"
                >
                  <div>
                    <b className="text-sm text-[#17221b]">{item.title}</b>
                    <p className="mt-0.5 text-[11px] text-[#68756c]">{item.detail}</p>
                  </div>

                  {stg.status === "Released" && item.actionText && (
                    <button
                      type="button"
                      onClick={handleDownloadPacket}
                      className="rounded-lg bg-[#276332] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1e4e26]"
                    >
                      {downloadedPacket ? "Packet Downloaded ✓" : item.actionText}
                    </button>
                  )}

                  {stg.status === "Timelocked" && (
                    <span className="text-[11px] font-semibold text-[#68756c] bg-white border border-[#e1e8e1] px-2.5 py-1 rounded">
                      Ciphertext Protected · Opens Post-Timelock
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
