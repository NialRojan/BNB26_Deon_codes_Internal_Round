import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVault } from "../../lib/vault";
import { Button, Card, Field, field, Page } from "../../components/ui";
import { AssetEditor } from "./AssetClassification";
import { GuardiansEditor, HeirsEditor } from "./PartiesAssignment";

const steps = ["Assets", "Guardians", "Heirs", "Policy", "Review"];

export default function SetupPage() {
  const v = useVault();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const blocked =
    (i === 1 && v.guardians.length < v.k) ||
    (i === 2 && !v.heirs.some((h) => h.tier === "Executor"));

  const sign = () => {
    // TODO: sign the policy with the owner key and send it to HeirloomVault (Member 2).
    v.log(
      `Release policy signed: ${v.k} of ${v.guardians.length} guardians, ${v.vetoDays} day veto window.`,
    );
    nav("/");
  };

  return (
    <Page
      title="Set up your vault"
      intro="Five steps. You can change any of them later, but you must sign again."
    >
      <ol
        className="glass flex gap-1 overflow-x-auto rounded-xl p-1"
        aria-label="Setup progress"
      >
        {steps.map((s, n) => (
          <li key={s} className="flex-1">
            <button
              onClick={() => setI(n)}
              aria-current={n === i ? "step" : undefined}
              className={`w-full whitespace-nowrap rounded-lg px-3 py-2 text-sm ${n === i ? "bg-lime font-semibold text-ink" : n < i ? "text-white" : "text-white/55"}`}
            >
              {n + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {i === 0 && <AssetEditor />}
      {i === 1 && <GuardiansEditor />}
      {i === 2 && <HeirsEditor />}
      {i === 3 && (
        <Card>
          <h2 className="text-xl font-bold">Release policy</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label="Check-in every">
              <select
                className={`${field} bg-ink`}
                value={v.policy.checkInDays}
                onChange={(e) =>
                  v.setPolicy({
                    ...v.policy,
                    checkInDays: Number(e.target.value),
                  })
                }
              >
                {[1, 3, 7, 14, 30].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Missed check-ins before Watch">
              <select
                className={`${field} bg-ink`}
                value={v.policy.missedLimit}
                onChange={(e) =>
                  v.setPolicy({
                    ...v.policy,
                    missedLimit: Number(e.target.value),
                  })
                }
              >
                {[2, 3, 4, 5].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <label htmlFor="veto" className="text-sm">
                Veto window:{" "}
                <span className="font-bold">{v.vetoDays} days</span>
              </label>
              <input
                id="veto"
                type="range"
                min={7}
                max={14}
                value={v.vetoDays}
                onChange={(e) => v.setVetoDays(Number(e.target.value))}
                className="mt-2 w-full accent-[#7CFF3F]"
              />
              <p className="mt-1 text-xs text-white/55">
                You can cancel any recovery with one tap until this timer ends.
              </p>
            </div>
          </div>
        </Card>
      )}
      {i === 4 && (
        <Card>
          <h2 className="text-xl font-bold">Review and sign</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-white/55">Assets protected</dt>
              <dd className="font-semibold">{v.assets.length}</dd>
            </div>
            <div>
              <dt className="text-white/55">Guardian threshold</dt>
              <dd className="font-semibold">
                {v.k} of {v.guardians.length}
              </dd>
            </div>
            <div>
              <dt className="text-white/55">Heirs</dt>
              <dd className="font-semibold">{v.heirs.length}</dd>
            </div>
            <div>
              <dt className="text-white/55">Veto window</dt>
              <dd className="font-semibold">{v.vetoDays} days</dd>
            </div>
            <div>
              <dt className="text-white/55">Check-in</dt>
              <dd className="font-semibold">
                Every {v.policy.checkInDays} days, Watch after{" "}
                {v.policy.missedLimit} misses
              </dd>
            </div>
          </dl>
          <Button className="mt-5" onClick={sign}>
            Sign and activate
          </Button>
        </Card>
      )}

      {blocked && (
        <p role="alert" className="text-sm text-[#FF8A5B]">
          {i === 1
            ? `Add at least ${v.k} guardians to continue.`
            : "Name an executor to continue."}
        </p>
      )}
      <div className="flex justify-between">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </Button>
        {i < steps.length - 1 && (
          <Button disabled={blocked} onClick={() => setI(i + 1)}>
            Continue
          </Button>
        )}
      </div>
    </Page>
  );
}
