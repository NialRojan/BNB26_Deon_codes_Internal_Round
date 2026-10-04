import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import type { ClientVault } from '../../../data/mockData'
import { predictVaultAddress, ZERO } from '../../../lib/chain'
import { buildVaultConfig, describePlan, validatePlan, willClause, type VaultRules } from '../../../lib/vaultPlan'

const label = 'text-[10px] uppercase font-bold text-[#718077]'

/** Plain-English rules summary for the review step. */
export function PlanSummary({ data, rules }: { data: Omit<ClientVault, 'id'>; rules: VaultRules }) {
  return (
    <div>
      <span className={label}>The rules this vault will enforce</span>
      <ul className="mt-1 list-disc space-y-1 rounded-lg border border-[#e1e8e1] bg-[#f8faf7] p-3 pl-7 text-xs text-[#2b382e]">
        {describePlan(data, rules).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

/** Copyable clause text for the physical will. */
export function WillClause({ clientName, vault, firmName, required, guardians, vetoHours, pending }: { clientName: string; vault: string; firmName: string; required: number; guardians: number; vetoHours: number; pending?: boolean }) {
  const [copied, setCopied] = useState(false)
  const text = willClause({ clientName, vault, firmName, required, guardians, vetoHours })
  return (
    <div className="rounded-xl border border-[#e1e8e1] bg-white p-4 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <span className={label}>Clause for the client's will {pending && '(address reserved; vault not created yet)'}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="rounded bg-[#f5f7f4] px-2 py-1 text-[11px] font-medium text-[#2d5836] hover:bg-[#eaf4df]"
        >
          {copied ? 'Copied ✓' : 'Copy clause'}
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[#2b382e]">{text}</p>
      <p className="mt-2 text-[10px] text-[#869188]">Draft wording for the firm to adapt to the jurisdiction. Not legal advice.</p>
    </div>
  )
}

/** Before creation: the exact address the factory will assign to this config, plus the will clause. */
export function AddressPreview({ data, rules, salt, firmWallet, firmName, live }: { data: Omit<ClientVault, 'id'>; rules: VaultRules; salt: bigint; firmWallet?: string | null; firmName: string; live: boolean }) {
  const [addr, setAddr] = useState<string | null>(null)
  const problems = validatePlan(data, rules)
  const key = JSON.stringify({ data, rules, firmWallet }, (_, v) => (typeof v === 'bigint' ? v.toString() : v))

  useEffect(() => {
    if (!live || problems.length) return setAddr(null)
    let cancelled = false
    predictVaultAddress(buildVaultConfig(data, rules, (firmWallet ?? ZERO) as Address), salt)
      .then((a) => !cancelled && setAddr(a))
      .catch(() => !cancelled && setAddr(null))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, salt])

  if (!live) return <p className="text-[11px] text-[#718077]">Connect to Sepolia to reserve a real vault address.</p>
  if (problems.length)
    return (
      <div className="rounded-lg bg-[#fef2f2] p-3 text-xs text-[#b91c1c]">
        <b>Fix before creating:</b>
        <ul className="mt-1 list-disc pl-5">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#cfe3b8] bg-[#f8faf4] p-3 text-xs">
        <span className={label}>Vault address (reserved for exactly these rules)</span>
        <div className="mt-1 break-all font-mono font-semibold text-[#17221b]">{addr ?? 'Calculating…'}</div>
        <p className="mt-1 text-[10px] text-[#718077]">Put this address in the will now. Creating the vault later with the same rules gives this exact address; any change to the rules gives a different one.</p>
      </div>
      {addr && <WillClause clientName={data.clientName} vault={addr} firmName={firmName} required={data.requiredApprovals} guardians={data.guardians.length} vetoHours={data.vetoHours} pending />}
    </div>
  )
}

/** What the lawyer needs from the client before starting the wizard. */
export function RequirementsChecklist() {
  const items = [
    ["Client's wallet address", "The client must control it: they own the vault and are the only one who can deposit or change rules."],
    ['Each heir: name, relationship, wallet, share %', 'Shares must add up to 100%. Heirs can use a fresh wallet; they only need it to receive.'],
    ['Guardians and how many must agree', 'Usually the firm plus 1–2 family members, with 2 required. Guardians need a wallet but no ETH (votes are gasless).'],
    ['Timers', 'Inactivity before guardians may act (e.g. 30 days) and the client veto window (e.g. 48 hours).'],
    ['Any special wishes (optional)', 'Unlock dates (e.g. 21st birthday), staged payments, different heirs per asset, NFTs to named people.'],
    ['Firm wallet with a little Sepolia ETH', 'It signs in the firm and pays for creating the vault (~0.001 ETH). The firm never controls the client\'s assets.'],
  ]
  return (
    <details className="rounded-xl border border-[#e1e8e1] bg-white p-4 text-xs shadow-sm" open>
      <summary className="cursor-pointer font-bold text-[#17221b]">Before you start: what to collect from the client</summary>
      <ul className="mt-3 space-y-2">
        {items.map(([t, d]) => (
          <li key={t}>
            <b className="text-[#17221b]">{t}</b>
            <div className="text-[11px] text-[#718077]">{d}</div>
          </li>
        ))}
      </ul>
    </details>
  )
}
