import { useState } from "react";
import { type AssetKind, useVault } from "../../lib/vault";
import { encryptLocal, SECRET_WORDS } from "../../lib/crypto";
import { Button, Card, Field, field, Page } from "../../components/ui";
import { SealSecretCard } from "../../components/EscrowPanels";

const kinds: { id: AssetKind; title: string; blurb: string }[] = [
  {
    id: "crypto",
    title: "Crypto vault",
    blurb: "Seed phrases and key shards. Released last.",
  },
  {
    id: "access",
    title: "Access kit",
    blurb: "Password manager recovery keys and 2FA backup codes.",
  },
  {
    id: "legal",
    title: "Legal packet",
    blurb: "Accounts and nominees for your executor. No passwords.",
  },
];
const accessTypes = [
  "Password manager recovery key",
  "2FA backup codes",
  "Email recovery code",
  "Cloud account recovery",
];
const legalTypes = [
  "Bank account",
  "UPI wallet",
  "Demat account",
  "Insurance policy",
  "Other",
];

export function AssetEditor() {
  const v = useVault();
  const [kind, setKind] = useState<AssetKind>("crypto");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [type, setType] = useState("");
  const [ref, setRef] = useState("");
  const [nominee, setNominee] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setLabel("");
    setSecret("");
    setRef("");
    setNominee("");
    setNotes("");
    setError("");
  };

  const add = async () => {
    if (!label.trim()) return setError("Give this item a name.");
    if (kind === "legal") {
      if (SECRET_WORDS.test(`${label} ${notes} ${nominee}`))
        return setError(
          "Remove passwords and PINs. They stay out of the legal packet.",
        );
      v.addAsset({
        kind,
        label: label.trim(),
        detail: `${type || legalTypes[0]}${ref ? ` ending ${ref}` : ""}, nominee ${nominee || "not set"}`,
      });
    } else {
      if (!secret.trim()) return setError("Paste the secret to encrypt.");
      setBusy(true);
      await encryptLocal(secret);
      setBusy(false);
      v.addAsset({
        kind,
        label: label.trim(),
        detail: "Encrypted on this device",
      });
    }
    v.log(
      `Added "${label.trim()}" to your ${kinds.find((k) => k.id === kind)!.title.toLowerCase()}.`,
    );
    reset();
  };

  return (
    <div className="space-y-6">
      <div
        className="grid gap-3 md:grid-cols-3"
        role="tablist"
        aria-label="Asset type"
      >
        {kinds.map((k) => (
          <button
            key={k.id}
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => {
              setKind(k.id);
              setType("");
              reset();
            }}
            className={`glass rounded-2xl p-4 text-left transition ${kind === k.id ? "border-lime ring-1 ring-lime" : "hover:border-white/30"}`}
          >
            <div className="font-bold">{k.title}</div>
            <div className="mt-1 text-xs text-white/60">{k.blurb}</div>
          </button>
        ))}
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={kind === "legal" ? "Institution" : "Name"}>
            <input
              className={field}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                kind === "legal" ? "HDFC Bank" : "Ledger seed phrase"
              }
            />
          </Field>
          {kind !== "crypto" && (
            <Field label="Type">
              <select
                className={`${field} bg-ink`}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {(kind === "access" ? accessTypes : legalTypes).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          )}
          {kind === "legal" ? (
            <>
              <Field label="Account reference (last 4 digits)">
                <input
                  className={field}
                  maxLength={4}
                  inputMode="numeric"
                  value={ref}
                  onChange={(e) => setRef(e.target.value.replace(/\D/g, ""))}
                  placeholder="4417"
                />
              </Field>
              <Field label="Nominee">
                <input
                  className={field}
                  value={nominee}
                  onChange={(e) => setNominee(e.target.value)}
                  placeholder="Sana Khan"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes for your executor">
                  <textarea
                    className={field}
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Branch, relationship manager, where the passbook is kept"
                  />
                </Field>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <Field label="Secret">
                <textarea
                  className={`${field} [-webkit-text-security:disc]`}
                  rows={3}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Paste here. It is encrypted in this browser before anything is sent."
                  autoComplete="off"
                />
              </Field>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#FF8A5B]">
            {error}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={add} disabled={busy}>
            {busy ? "Encrypting" : "Add to vault"}
          </Button>
          {kind !== "legal" && (
            <span className="text-xs text-white/55">
              Only ciphertext leaves this device.
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {kinds.map((k) => (
          <Card key={k.id}>
            <h2 className="font-bold">{k.title}</h2>
            <ul className="mt-3 space-y-2">
              {v.assets
                .filter((a) => a.kind === k.id)
                .map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <span>
                      {a.label}
                      <span className="block text-xs text-white/55">
                        {a.detail}
                      </span>
                    </span>
                    <button
                      className="text-xs text-white/50 hover:text-white"
                      onClick={() => v.removeAsset(a.id)}
                      aria-label={`Remove ${a.label}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              {v.assets.filter((a) => a.kind === k.id).length === 0 && (
                <li className="text-sm text-white/50">Nothing added yet.</li>
              )}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const { live } = useVault();
  return (
    <Page
      title="What you are protecting"
      intro="Each asset type is released in a different way. Pick one, add it, and it stays encrypted on your device."
    >
      {live && <SealSecretCard />}
      <AssetEditor />
    </Page>
  );
}
