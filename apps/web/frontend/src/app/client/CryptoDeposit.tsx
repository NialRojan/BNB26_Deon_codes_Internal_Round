import { useState } from "react";
import { Link } from "react-router-dom";
import { useB2B2C } from "../../lib/b2b2cStore";

type TxState = "idle" | "waiting" | "pending" | "confirmed";

export default function CryptoDeposit() {
  const { activeVault, recordDeposit } = useB2B2C();
  const [asset, setAsset] = useState<string>("ETH");
  const [amount, setAmount] = useState<string>("2.5");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string>("");

  const balances: Record<string, string> = {
    ETH: "14.85 ETH",
    USDC: "45,000 USDC",
    USDT: "12,500 USDT",
    BTC: "1.42 BTC",
  };

  const handleDeposit = () => {
    setTxState("waiting");
    setTimeout(() => {
      setTxState("pending");
      const hash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      setTxHash(hash);
      setTimeout(() => {
        setTxState("confirmed");
        recordDeposit(activeVault.id, asset, amount, hash);
      }, 2500);
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#e1e8e1] pb-4">
        <div>
          <span className="section-kicker">CLIENT-CONTROLLED FUNDING</span>
          <h2 className="text-2xl font-bold text-[#17221b]">Deposit Crypto to Vault</h2>
          <p className="text-xs text-[#718077]">
            Only the vault owner has the cryptographic right to deposit or withdraw assets.
          </p>
        </div>
        <Link
          to="/client/assets"
          className="rounded-lg border border-[#dce4dc] px-3 py-1.5 text-xs font-semibold text-[#2b382e] hover:bg-[#f5f7f4]"
        >
          ← Asset Inventory
        </Link>
      </div>

      {/* Conceptual Flow Diagram */}
      <div className="rounded-xl border border-[#b9d79e] bg-[#f8faf4] p-5 shadow-sm">
        <span className="text-[10px] uppercase font-bold text-[#3d8b50]">Direct Custodial Flow</span>
        <div className="mt-3 flex items-center justify-between text-center text-xs">
          <div className="flex-1 rounded-lg bg-white p-3 border border-[#e1e8e1]">
            <span className="text-base">💼</span>
            <div className="mt-1 font-bold text-[#17221b]">Your Personal Wallet</div>
            <div className="text-[10px] text-[#718077] truncate">{activeVault.clientWallet.slice(0, 12)}...</div>
          </div>

          <div className="flex flex-col items-center px-4">
            <span className="text-xs font-bold text-[#276332]">Client-Controlled</span>
            <span className="text-base text-[#a3e635]">───►</span>
            <span className="text-[9px] text-[#869188]">No law firm custody</span>
          </div>

          <div className="flex-1 rounded-lg bg-white p-3 border border-[#e1e8e1]">
            <span className="text-base">🏛️</span>
            <div className="mt-1 font-bold text-[#17221b]">Heirloom Vault</div>
            <div className="text-[10px] text-[#718077] truncate">{activeVault.vaultAddress.slice(0, 12)}...</div>
          </div>
        </div>
      </div>

      {/* Deposit Form */}
      <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#2b382e]">Select Asset / Token</label>
          <div className="grid grid-cols-4 gap-2">
            {["ETH", "USDC", "USDT", "BTC"].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => setAsset(sym)}
                className={`rounded-lg border p-2.5 text-center text-xs font-bold transition ${
                  asset === sym
                    ? "border-[#a3e635] bg-[#f8faf4] text-[#17221b] ring-1 ring-[#a3e635]"
                    : "border-[#e1e8e1] text-[#6b786e] hover:bg-[#f5f7f4]"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <label className="font-semibold text-[#2b382e]">Deposit Amount</label>
            <span className="text-[11px] text-[#718077]">
              Available Wallet Balance: <b>{balances[asset]}</b>
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-[#dce4dc] px-3 py-2.5 text-sm font-bold text-[#17221b] outline-none focus:border-[#a3e635]"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-[#718077]">{asset}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#2b382e]">Destination Vault Address</label>
          <div className="rounded-lg border border-[#dce4dc] bg-[#f8faf7] p-2.5 font-mono text-xs text-[#2b382e] break-all">
            {activeVault.vaultAddress}
          </div>
          <p className="mt-1 text-[10px] text-[#718077]">
            Funds sent to this smart contract address are guarded by your configured guardian threshold and release conditions.
          </p>
        </div>

        {/* Transaction Status Box */}
        {txState !== "idle" && (
          <div
            className={`rounded-xl border p-4 text-xs ${
              txState === "waiting"
                ? "border-[#fde3a7] bg-[#fffbf0] text-[#9a6700]"
                : txState === "pending"
                ? "border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]"
                : "border-[#b9d79e] bg-[#f8faf4] text-[#276332]"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {txState === "waiting" && <span>⏳ Waiting for Wallet Confirmation...</span>}
              {txState === "pending" && <span>⛓️ Transaction Pending on Blockchain...</span>}
              {txState === "confirmed" && <span>✓ Deposit Confirmed into Vault!</span>}
            </div>

            <p className="mt-1 text-[11px]">
              {txState === "waiting" && "Please approve the transaction in your Web3 wallet (MetaMask, Rabby, Ledger)."}
              {txState === "pending" && `Broadcast to network: ${txHash.slice(0, 20)}... Waiting for block inclusion.`}
              {txState === "confirmed" && `Successfully credited ${amount} ${asset} to your Heirloom Vault. Updated in asset registry.`}
            </p>

            {txHash && (
              <div className="mt-2 font-mono text-[10px] truncate">
                TxHash: <span className="underline">{txHash}</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          {txState === "confirmed" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTxState("idle")}
                className="flex-1 rounded-lg border border-[#dce4dc] py-2.5 text-xs font-bold text-[#17221b] hover:bg-[#f5f7f4]"
              >
                Deposit Another Asset
              </button>
              <Link
                to="/client/vault"
                className="flex-1 rounded-lg bg-[#a3e635] py-2.5 text-center text-xs font-bold text-[#17221b] hover:brightness-95"
              >
                View Client Dashboard →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={txState === "waiting" || txState === "pending" || !amount || Number(amount) <= 0}
              onClick={handleDeposit}
              className="w-full rounded-lg bg-[#17221b] py-3 text-xs font-bold text-white shadow-sm hover:bg-black disabled:opacity-40"
            >
              {txState === "waiting"
                ? "Connecting to Wallet…"
                : txState === "pending"
                ? "Confirming On-Chain…"
                : `Deposit ${amount} ${asset} from Personal Wallet`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
