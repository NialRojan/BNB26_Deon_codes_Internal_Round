import { Link, useLocation } from "react-router-dom";
import { useVault, type VaultState } from "../lib/vault";
import { addrUrl, short } from "../lib/chain";
import { formatEther } from "viem";

const states: VaultState[] = [
  "Active",
  "Watch",
  "TriggerPending",
  "VetoWindow",
  "StagedRelease",
  "Executed",
];
const b =
  "rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10";

export default function DemoBar() {
  const v = useVault();
  const onClientPage = useLocation().pathname.startsWith("/client");
  return (
    <details className="glass fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)] rounded-xl text-sm">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold">
        Demo controls
      </summary>
      <div className="space-y-3 border-t border-white/10 p-3">
        <div className="flex gap-1.5" role="group" aria-label="Data source">
          <button className={`${b} ${v.live ? "bg-white/15" : ""}`} onClick={() => v.setLive(true)}>Sepolia (live)</button>
          <button className={`${b} ${!v.live ? "bg-white/15" : ""}`} onClick={() => v.setLive(false)}>Local demo</button>
        </div>
        {v.live ? (
          <div className="space-y-1.5 text-xs text-white/70">
            {v.chain.vault ? (
              <>
                <p>Vault <a className="underline" href={addrUrl(v.chain.vault.address)} target="_blank" rel="noreferrer">{short(v.chain.vault.address)}</a> · {formatEther(v.chain.vault.ethBalance)} ETH</p>
                <p>Guardian votes: {v.chain.vault.currentSignatures} / {v.chain.vault.requiredSignatures}</p>
                <p>Watch starts {new Date(v.chain.vault.watchStartsAt).toLocaleTimeString()}</p>
              </>
            ) : (
              <p>Reading vault from Sepolia…</p>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button className={b} onClick={v.checkIn}>Owner: I'm alive</button>
              <button className={b} onClick={v.chain.attest}>Guardian: attest</button>
              {onClientPage && <button className={b} onClick={v.cancelRecovery}>Owner: veto</button>}
              <button className={b} onClick={v.advance}>Execute release</button>
              <button className={b} onClick={v.chain.claimEth}>Heir: claim ETH</button>
            </div>
            <p className="text-white/50">Each button sends a real transaction from the connected MetaMask account.</p>
          </div>
        ) : (
        <>
        <div>
          <p className="mb-1.5 text-xs text-white/60">Adversarial scenarios</p>
          <div className="flex flex-wrap gap-1.5">
            <button className={b} onClick={() => v.runScenario("rogue")}>
              Rogue guardian
            </button>
            <button className={b} onClick={() => v.runScenario("collusion")}>
              Colluding guardians
            </button>
            <button className={b} onClick={() => v.runScenario("legit")}>
              Legitimate recovery
            </button>
            <button className={b} onClick={v.advance}>
              Advance stage
            </button>
            <button className={b} onClick={v.reset}>
              Reset
            </button>
          </div>
        </div>
        <label className="block text-xs text-white/60">
          Vault state
          <select
            className="mt-1 block w-full rounded-md border border-white/15 bg-ink px-2 py-1.5 text-sm text-white"
            value={v.state}
            onChange={(e) => v.setVaultState(e.target.value as VaultState)}
          >
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        </>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Link className={b} to="/app">
            Owner
          </Link>
          <Link className={b} to="/guardian">
            Guardian
          </Link>
          <Link className={b} to="/executor">
            Executor
          </Link>
          <Link className={b} to="/heir">
            Heir
          </Link>
        </div>
      </div>
    </details>
  );
}
