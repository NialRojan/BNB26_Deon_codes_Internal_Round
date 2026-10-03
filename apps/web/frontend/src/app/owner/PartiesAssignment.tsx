import { useState } from "react";
import { type Tier, useVault } from "../../lib/vault";
import { Button, Card, Field, field, Page } from "../../components/ui";

const tiers: Tier[] = ["Executor", "Family", "Business", "Crypto heir"];
const tierHelp: Record<Tier, string> = {
  Executor: "Receives the legal packet first",
  Family: "Receives the access kit",
  Business: "Receives scoped business access",
  "Crypto heir": "Receives crypto shards last",
};

export function GuardiansEditor() {
  const v = useVault();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const n = v.guardians.length;
  const short = n < v.k;

  return (
    <Card>
      <h2 className="text-xl font-bold">Guardians</h2>
      <p className="mt-1 text-sm text-white/60">
        People who confirm you are gone. No single guardian can open anything
        alone.
      </p>

      <div className="mt-5">
        <label className="text-sm" htmlFor="k">
          Guardians needed to attest:{" "}
          <span className="font-bold">
            {v.k} of {n}
          </span>
        </label>
        <input
          id="k"
          type="range"
          min={2}
          max={Math.max(2, n)}
          value={Math.min(v.k, Math.max(2, n))}
          onChange={(e) => v.setK(Number(e.target.value))}
          className="mt-2 w-full accent-[#7CFF3F]"
        />
        {short && (
          <p role="alert" className="mt-1 text-sm text-[#FF8A5B]">
            You need at least {v.k} guardians for this threshold.
          </p>
        )}
      </div>

      <ul className="mt-4 divide-y divide-white/10">
        {v.guardians.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between py-2.5 text-sm"
          >
            <span>
              {g.name}
              <span className="block text-xs text-white/55">{g.contact}</span>
            </span>
            <button
              className="text-xs text-white/50 hover:text-white"
              onClick={() => v.removeGuardian(g.id)}
              aria-label={`Remove ${g.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Name">
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email or phone">
          <input
            className={field}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
        <Button
          disabled={!name.trim() || !contact.trim()}
          onClick={() => {
            v.addGuardian({ name: name.trim(), contact: contact.trim() });
            setName("");
            setContact("");
          }}
        >
          Add guardian
        </Button>
      </div>
    </Card>
  );
}

export function HeirsEditor() {
  const v = useVault();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [tier, setTier] = useState<Tier>("Executor");

  return (
    <Card>
      <h2 className="text-xl font-bold">Heirs and executor</h2>
      <p className="mt-1 text-sm text-white/60">
        Each person gets a tier. The tier decides what they can open, and when.
      </p>

      <ul className="mt-4 divide-y divide-white/10">
        {v.heirs.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between gap-3 py-2.5 text-sm"
          >
            <span>
              {h.name}
              <span className="block text-xs text-white/55">{h.contact}</span>
            </span>
            <span className="ml-auto rounded-full border border-white/20 px-2.5 py-1 text-xs">
              {h.tier}
            </span>
            <button
              className="text-xs text-white/50 hover:text-white"
              onClick={() => v.removeHeir(h.id)}
              aria-label={`Remove ${h.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email or phone">
          <input
            className={field}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </Field>
        <Field label="Tier">
          <select
            className={`${field} bg-ink`}
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
          >
            {tiers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-3">
          <Button
            disabled={!name.trim() || !contact.trim()}
            onClick={() => {
              v.addHeir({ name: name.trim(), contact: contact.trim(), tier });
              setName("");
              setContact("");
            }}
          >
            Add person
          </Button>
          <span className="pb-2 text-xs text-white/55">{tierHelp[tier]}</span>
        </div>
      </div>
    </Card>
  );
}

export default function PeoplePage() {
  return (
    <Page
      title="Who is involved"
      intro="Guardians confirm. Heirs receive. Nobody in either group can do the other's job."
    >
      <GuardiansEditor />
      <HeirsEditor />
    </Page>
  );
}
