// Turns the lawyer's wizard input (heirs, guardians, timers + optional special rules) into the
// HeirloomVault v2 Config, a plain-English summary, and a draft will clause.
import type { Address } from 'viem'
import type { ClientVault, HeirItem } from '../data/mockData'
import type { VaultConfig } from './chain'

const ZERO = '0x0000000000000000000000000000000000000000' as Address
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test((a ?? '').trim())

/** Per-heir conditions on their share (applies to every asset that heir is named for). */
export interface HeirCondition {
  unlockDate?: string // YYYY-MM-DD; nothing is paid before this date (e.g. 21st birthday)
  installments: number // 1 = paid at once
  intervalDays: number // days between installments
}

/** A specific token (or ETH) split differently from the default. Percentages per heir id. */
export interface TokenRule {
  token: string // 0x… token contract, or "ETH"
  label: string // e.g. "USDC"
  shares: Record<string, number> // heirId -> %
}

/** A specific NFT left to a specific heir. */
export interface NftRuleInput {
  collection: string
  tokenId: string
  heirId: string
}

export interface VaultRules {
  conditions: Record<string, HeirCondition>
  tokenRules: TokenRule[]
  nftRules: NftRuleInput[]
  nftFallbackHeirId: string // "" = none
}

export const emptyRules = (): VaultRules => ({ conditions: {}, tokenRules: [], nftRules: [], nftFallbackHeirId: '' })

const DAY = 86400
const toUnix = (date?: string) => (date ? BigInt(Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000)) : 0n)

/** Date a person born on `dob` turns `age` (YYYY-MM-DD). */
export function dateAtAge(dob: string, age: number): string {
  const d = new Date(`${dob}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + age)
  return d.toISOString().slice(0, 10)
}

function allocationFor(h: { wallet: string; pct: number }, cond?: HeirCondition) {
  const installments = Math.max(1, Math.floor(cond?.installments ?? 1))
  return {
    beneficiary: h.wallet.trim() as Address,
    bps: Math.round(h.pct * 100),
    unlockAt: toUnix(cond?.unlockDate),
    installments,
    interval: installments > 1 ? Math.max(1, Math.round((cond?.intervalDays ?? 0) * DAY)) : 0,
  }
}

/** Problems a lawyer must fix before the vault can be created (empty = OK). */
export function validatePlan(data: Omit<ClientVault, 'id'>, rules: VaultRules): string[] {
  const errs: string[] = []
  const heirById = new Map(data.heirs.map((h) => [h.id, h]))
  if (!isAddr(data.clientWallet)) errs.push('Client wallet must be a full address (0x + 40 hex characters).')
  data.heirs.forEach((h) => !isAddr(h.wallet) && errs.push(`Heir "${h.name}" needs a full wallet address.`))
  data.guardians.forEach((g) => !isAddr(g.wallet) && errs.push(`Guardian "${g.name}" needs a full wallet address.`))
  if (data.heirs.reduce((s, h) => s + Number(h.percentage), 0) !== 100) errs.push('Default heir percentages must add up to 100%.')
  if (data.requiredApprovals < 1 || data.requiredApprovals > data.guardians.length) errs.push('Guardian threshold must be between 1 and the number of guardians.')
  const lc = data.clientWallet.trim().toLowerCase()
  if ([...data.heirs, ...data.guardians].some((p) => p.wallet.trim().toLowerCase() === lc)) errs.push('The client cannot also be an heir or guardian.')

  for (const [id, c] of Object.entries(rules.conditions)) {
    const name = heirById.get(id)?.name ?? id
    if (c.installments > 1 && !(c.intervalDays > 0)) errs.push(`"${name}": staged payouts need the number of days between payments.`)
    if (c.installments < 1 || c.installments > 120) errs.push(`"${name}": installments must be between 1 and 120.`)
  }
  rules.tokenRules.forEach((t, i) => {
    if (t.token !== 'ETH' && !isAddr(t.token)) errs.push(`Asset rule ${i + 1}: enter the token contract address (or ETH).`)
    const total = Object.values(t.shares).reduce((s, p) => s + Number(p || 0), 0)
    if (total !== 100) errs.push(`Asset rule "${t.label || i + 1}": shares must add up to 100% (now ${total}%).`)
  })
  const tokens = rules.tokenRules.map((t) => t.token.toLowerCase())
  if (new Set(tokens).size !== tokens.length) errs.push('Each asset can only have one special split.')
  rules.nftRules.forEach((n, i) => {
    if (!isAddr(n.collection)) errs.push(`NFT ${i + 1}: enter the collection contract address.`)
    if (!/^\d+$/.test(n.tokenId.trim())) errs.push(`NFT ${i + 1}: token id must be a number.`)
    if (!heirById.has(n.heirId)) errs.push(`NFT ${i + 1}: choose who receives it.`)
  })
  return errs
}

/** Build the on-chain vault config. The firm wallet becomes the executor. */
export function buildVaultConfig(data: Omit<ClientVault, 'id'>, rules: VaultRules, firmWallet: Address): VaultConfig {
  const heirById = new Map(data.heirs.map((h) => [h.id, h]))
  const alloc = (h: HeirItem, pct: number) => allocationFor({ wallet: h.wallet, pct }, rules.conditions[h.id])
  return {
    owner: data.clientWallet.trim() as Address,
    executor: firmWallet,
    guardians: data.guardians.map((g) => g.wallet.trim() as Address),
    requiredSignatures: BigInt(data.requiredApprovals),
    inactivityThreshold: BigInt(Math.max(60, Math.round(data.inactivityDays * DAY))),
    vetoGracePeriod: BigInt(Math.max(60, Math.round(data.vetoHours * 3600))),
    assetMapCID: '',
    defaultAllocations: data.heirs.map((h) => alloc(h, Number(h.percentage))),
    tokenPlans: rules.tokenRules.map((t) => ({
      token: (t.token === 'ETH' ? ZERO : t.token.trim()) as Address,
      allocations: Object.entries(t.shares)
        .filter(([, pct]) => Number(pct) > 0)
        .map(([id, pct]) => alloc(heirById.get(id)!, Number(pct))),
    })),
    nftRules: rules.nftRules.map((n) => ({
      collection: n.collection.trim() as Address,
      tokenId: BigInt(n.tokenId.trim()),
      beneficiary: heirById.get(n.heirId)!.wallet.trim() as Address,
      unlockAt: toUnix(rules.conditions[n.heirId]?.unlockDate),
    })),
    nftFallback: rules.nftFallbackHeirId ? (heirById.get(rules.nftFallbackHeirId)?.wallet.trim() as Address) : ZERO,
  }
}

/** 120 -> "2 minutes", 2_592_000 -> "30 days". */
export function human(seconds: number): string {
  const s = Math.round(seconds)
  const unit = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`
  if (s < 3600) return unit(Math.max(1, Math.round(s / 60)), 'minute')
  if (s < DAY) return unit(Math.round(s / 3600), 'hour')
  return unit(Math.round(s / DAY), 'day')
}

/** Plain-English list of the rules, for the review screen and the client's onboarding. */
export function describePlan(data: Omit<ClientVault, 'id'>, rules: VaultRules): string[] {
  const name = (id: string) => data.heirs.find((h) => h.id === id)?.name ?? '—'
  const lines: string[] = [`Default split (every asset without its own rule): ${data.heirs.map((h) => `${h.name} ${h.percentage}%`).join(', ')}.`]
  for (const t of rules.tokenRules) {
    const parts = Object.entries(t.shares).filter(([, p]) => Number(p) > 0).map(([id, p]) => `${name(id)} ${p}%`)
    lines.push(`${t.label || t.token}: ${parts.join(', ')}.`)
  }
  for (const [id, c] of Object.entries(rules.conditions)) {
    const bits = []
    if (c.unlockDate) bits.push(`nothing before ${new Date(`${c.unlockDate}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'long' })}`)
    if (c.installments > 1) bits.push(`paid in ${c.installments} instalments, one every ${c.intervalDays} days`)
    if (bits.length) lines.push(`${name(id)}: ${bits.join('; ')}.`)
  }
  for (const n of rules.nftRules) lines.push(`NFT #${n.tokenId} from ${n.collection.slice(0, 8)}… goes to ${name(n.heirId)}.`)
  if (rules.nftFallbackHeirId) lines.push(`Any other NFT goes to ${name(rules.nftFallbackHeirId)}.`)
  lines.push(`Release needs ${data.requiredApprovals} of ${data.guardians.length} guardians after ${human(data.inactivityDays * DAY)} of inactivity, then a ${human(data.vetoHours * 3600)} client veto window.`)
  return lines
}

/** Draft clause for the physical will. A starting point for the lawyer, not legal advice. */
export function willClause(p: { clientName: string; vault: string; firmName: string; required: number; guardians: number; vetoHours: number }) {
  const veto = human(p.vetoHours * 3600)
  return `DIGITAL ASSETS. I, ${p.clientName}, direct that my digital assets held in, and the instructions recorded in, the smart contract deployed on the Ethereum network at address ${p.vault} (the "Heirloom Vault") be administered and distributed exclusively according to the rules encoded in that contract, which I have reviewed and approved. I appoint ${p.firmName} as executor of my digital estate and as one of the guardians of the Heirloom Vault. Release of my digital assets shall require the confirmation of ${p.required} of my ${p.guardians} appointed guardians, followed by a period of ${veto} during which I may cancel the release if I am alive. Passwords and other access credentials sealed in the Heirloom Vault shall be released only to the beneficiaries I have designated for each of them.`
}
