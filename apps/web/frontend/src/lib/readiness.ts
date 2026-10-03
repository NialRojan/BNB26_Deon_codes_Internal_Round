import type { CheckKey, Vault } from './vault'

export type CheckStatus = 'pass' | 'warn' | 'fail'
export interface Check {
  key: string
  title: string
  detail: string
  status: CheckStatus
  fix?: { to: string; label: string }
  manual?: CheckKey
}

export function computeReadiness(v: Vault) {
  const missing = Math.max(0, v.k - v.guardians.length)
  const stale = Date.now() - v.lastCheckIn > v.policy.checkInDays * 864e5
  const hasExecutor = v.heirs.some((h) => h.tier === 'Executor')
  const manual = (key: CheckKey, title: string, doneText: string, todoText: string, status: CheckStatus): Check => ({
    key, title, manual: key,
    status: v.checklist[key] ? 'pass' : status,
    detail: v.checklist[key] ? doneText : todoText,
  })
  const checks: Check[] = [
    {
      key: 'guardians', title: 'Guardians cover your threshold',
      status: missing === 0 ? 'pass' : 'fail',
      detail: missing === 0 ? `${v.guardians.length} guardians for a ${v.k} of ${v.guardians.length} threshold.` : `Add ${missing} more guardian${missing > 1 ? 's' : ''} or lower the threshold.`,
      fix: missing === 0 ? undefined : { to: '/people', label: 'Add guardians' },
    },
    {
      key: 'executor', title: 'An executor is named',
      status: hasExecutor ? 'pass' : 'fail',
      detail: hasExecutor ? 'Your executor receives the legal packet first.' : 'Nobody can open the legal packet yet.',
      fix: hasExecutor ? undefined : { to: '/people', label: 'Name an executor' },
    },
    {
      key: 'assets', title: 'Assets are added to the vault',
      status: v.assets.length > 0 ? 'pass' : 'warn',
      detail: v.assets.length > 0 ? `${v.assets.length} assets are protected.` : 'Your vault is empty.',
      fix: v.assets.length > 0 ? undefined : { to: '/assets', label: 'Add assets' },
    },
    {
      key: 'checkin', title: 'You checked in recently',
      status: stale ? 'warn' : 'pass',
      detail: stale ? `Your last check-in is older than ${v.policy.checkInDays} days.` : 'Your guardians can see you are fine.',
    },
    manual('bankNominees', 'Bank and demat nominees are registered', 'You confirmed nominees on every account.', 'Banks pay nominees fastest. Check each account has one.', 'fail'),
    manual('googleLegacy', 'Google Inactive Account Manager is set', 'A trusted contact is set on Google.', 'Set a trusted contact so Google can share your data.', 'warn'),
    manual('appleLegacy', 'Apple Legacy Contact is set', 'A legacy contact is set on your Apple ID.', 'Add a legacy contact so heirs can request your iCloud data.', 'warn'),
    manual('duressPin', 'Duress PIN is configured', 'A decoy vault opens if you are forced to unlock.', 'Set a second PIN that opens a decoy vault and alerts guardians.', 'warn'),
  ]
  const points = checks.reduce((n, c) => n + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0)
  return { checks, score: Math.round((points / checks.length) * 100) }
}
