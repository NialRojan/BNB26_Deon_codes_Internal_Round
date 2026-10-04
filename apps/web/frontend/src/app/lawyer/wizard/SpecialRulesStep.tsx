import { useState } from 'react'
import type { HeirItem } from '../../../data/mockData'
import { dateAtAge, type HeirCondition, type VaultRules } from '../../../lib/vaultPlan'

const card = 'rounded-xl border border-[#e1e8e1] p-4 text-xs space-y-3'
const input = 'rounded-lg border border-[#dce4dc] px-2.5 py-1.5 text-xs text-[#17221b]'
const small = 'text-[11px] text-[#718077]'
const addBtn = 'rounded-lg border border-[#cfe3b8] bg-[#f8faf4] px-3 py-1.5 text-xs font-semibold text-[#315c3d] hover:bg-[#eef6e4]'
const removeBtn = 'text-[11px] font-semibold text-[#b54a3f] hover:underline'

/** Optional rules on top of the default split: conditions, staged payouts, per-asset splits, NFTs. */
export default function SpecialRulesStep({ heirs, rules, onChange }: { heirs: HeirItem[]; rules: VaultRules; onChange: (r: VaultRules) => void }) {
  const [dob, setDob] = useState<Record<string, string>>({})
  const [age, setAge] = useState<Record<string, number>>({})

  const cond = (id: string): HeirCondition => rules.conditions[id] ?? { installments: 1, intervalDays: 0 }
  const setCond = (id: string, patch: Partial<HeirCondition>) =>
    onChange({ ...rules, conditions: { ...rules.conditions, [id]: { ...cond(id), ...patch } } })

  return (
    <div className="rounded-xl border border-[#e1e8e1] bg-white p-6 shadow-sm space-y-4">
      <div className="border-b border-[#edf0ed] pb-3">
        <h3 className="text-lg font-bold text-[#17221b]">Step 6 — Special Rules (optional)</h3>
        <p className="text-xs text-[#718077]">
          Everything here is enforced by the vault contract itself. Skip this step if the default split is all the client wants.
        </p>
      </div>

      {/* Conditions + staged payouts */}
      <div className={card}>
        <div>
          <b className="text-[#17221b]">When each heir receives their share</b>
          <p className={small}>e.g. "my son receives his share from his 21st birthday, in 4 yearly payments".</p>
        </div>
        {heirs.map((h) => {
          const c = cond(h.id)
          return (
            <div key={h.id} className="grid gap-2 rounded-lg bg-[#f8faf7] p-3 sm:grid-cols-[1.2fr_1.6fr_1.4fr]">
              <div>
                <b>{h.name}</b> <span className={small}>({h.relationship}, {h.percentage}%)</span>
              </div>
              <div className="space-y-1">
                <label className={small}>Not before (optional)</label>
                <input type="date" className={`${input} w-full`} value={c.unlockDate ?? ''} onChange={(e) => setCond(h.id, { unlockDate: e.target.value || undefined })} />
                <div className="flex flex-wrap items-center gap-1">
                  <span className={small}>or born</span>
                  <input type="date" className={input} value={dob[h.id] ?? ''} onChange={(e) => setDob({ ...dob, [h.id]: e.target.value })} aria-label={`${h.name} date of birth`} />
                  <span className={small}>at age</span>
                  <input type="number" min={1} max={100} className={`${input} w-16`} value={age[h.id] ?? 21} onChange={(e) => setAge({ ...age, [h.id]: Number(e.target.value) })} aria-label="age" />
                  <button type="button" className={addBtn} disabled={!dob[h.id]} onClick={() => setCond(h.id, { unlockDate: dateAtAge(dob[h.id]!, age[h.id] ?? 21) })}>
                    Set
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className={small}>Paid in</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} max={120} className={`${input} w-16`} value={c.installments} onChange={(e) => setCond(h.id, { installments: Math.max(1, Number(e.target.value)) })} aria-label="installments" />
                  <span className={small}>payment(s)</span>
                </div>
                {c.installments > 1 && (
                  <div className="flex items-center gap-1">
                    <span className={small}>every</span>
                    <input type="number" min={1} className={`${input} w-20`} value={c.intervalDays || ''} onChange={(e) => setCond(h.id, { intervalDays: Number(e.target.value) })} aria-label="days between payments" />
                    <span className={small}>days</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-asset splits */}
      <div className={card}>
        <div>
          <b className="text-[#17221b]">Different heirs for a specific asset</b>
          <p className={small}>e.g. "my USDC goes 100% to my wife, my ETH 100% to my son". Other assets keep the default split.</p>
        </div>
        {rules.tokenRules.map((t, i) => {
          const total = Object.values(t.shares).reduce((s, p) => s + Number(p || 0), 0)
          const update = (patch: Partial<typeof t>) => onChange({ ...rules, tokenRules: rules.tokenRules.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
          return (
            <div key={i} className="space-y-2 rounded-lg bg-[#f8faf7] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className={input} value={t.token === 'ETH' ? 'ETH' : 'TOKEN'} onChange={(e) => update(e.target.value === 'ETH' ? { token: 'ETH', label: 'ETH' } : { token: '', label: '' })}>
                  <option value="ETH">ETH</option>
                  <option value="TOKEN">A token (ERC-20)</option>
                </select>
                {t.token !== 'ETH' && (
                  <>
                    <input className={`${input} w-28`} placeholder="Name, e.g. USDC" value={t.label} onChange={(e) => update({ label: e.target.value })} />
                    <input className={`${input} min-w-0 flex-1 font-mono`} placeholder="Token contract 0x…" value={t.token} onChange={(e) => update({ token: e.target.value.trim() })} />
                  </>
                )}
                <button type="button" className={removeBtn} onClick={() => onChange({ ...rules, tokenRules: rules.tokenRules.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {heirs.map((h) => (
                  <label key={h.id} className="flex items-center gap-1">
                    {h.name}
                    <input type="number" min={0} max={100} className={`${input} w-16`} value={t.shares[h.id] ?? 0} onChange={(e) => update({ shares: { ...t.shares, [h.id]: Number(e.target.value) } })} />%
                  </label>
                ))}
                <span className={total === 100 ? 'font-semibold text-[#276332]' : 'font-semibold text-[#b91c1c]'}>Total {total}%</span>
              </div>
            </div>
          )
        })}
        <button type="button" className={addBtn} onClick={() => onChange({ ...rules, tokenRules: [...rules.tokenRules, { token: 'ETH', label: 'ETH', shares: {} }] })}>
          + Add an asset rule
        </button>
      </div>

      {/* NFTs */}
      <div className={card}>
        <div>
          <b className="text-[#17221b]">NFTs to specific people</b>
          <p className={small}>Each NFT goes to the named heir (from their "not before" date, if set).</p>
        </div>
        {rules.nftRules.map((n, i) => {
          const update = (patch: Partial<typeof n>) => onChange({ ...rules, nftRules: rules.nftRules.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8faf7] p-3">
              <input className={`${input} min-w-0 flex-1 font-mono`} placeholder="Collection contract 0x…" value={n.collection} onChange={(e) => update({ collection: e.target.value.trim() })} />
              <input className={`${input} w-24`} placeholder="Token id" value={n.tokenId} onChange={(e) => update({ tokenId: e.target.value })} />
              <select className={input} value={n.heirId} onChange={(e) => update({ heirId: e.target.value })}>
                <option value="">Goes to…</option>
                {heirs.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <button type="button" className={removeBtn} onClick={() => onChange({ ...rules, nftRules: rules.nftRules.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={addBtn} onClick={() => onChange({ ...rules, nftRules: [...rules.nftRules, { collection: '', tokenId: '', heirId: '' }] })}>
            + Add an NFT
          </button>
          <label className="flex items-center gap-1">
            <span className={small}>Any other NFT goes to</span>
            <select className={input} value={rules.nftFallbackHeirId} onChange={(e) => onChange({ ...rules, nftFallbackHeirId: e.target.value })}>
              <option value="">nobody (stays locked)</option>
              {heirs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
