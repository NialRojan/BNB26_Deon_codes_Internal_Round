import { Link } from "react-router-dom";
import { useVault, type VaultState } from "../lib/vault";

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
  return (
    <details className="glass fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)] rounded-xl text-sm">
      <summary className="cursor-pointer select-none px-3 py-2 font-semibold">
        Demo controls
      </summary>
      <div className="space-y-3 border-t border-white/10 p-3">
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
