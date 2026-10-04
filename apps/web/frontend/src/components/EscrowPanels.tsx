import { useCallback, useEffect, useState } from 'react'
import { useVault } from '../lib/vault'
import {
  hasLocalKey,
  listKeys,
  listSecrets,
  recoverSecrets,
  registerKey,
  releaseMyShares,
  sealSecret,
  type PublicKeyRow,
  type Recovered,
  type SecretRow,
} from '../lib/escrow'
import { short } from '../lib/chain'
import { Button, Card, field } from './ui'

/** Shared state + action runner for the escrow cards. */
function useEscrow() {
  const { chain } = useVault()
  const [keys, setKeys] = useState<PublicKeyRow[]>([])
  const [secrets, setSecrets] = useState<SecretRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const reload = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([listKeys(), listSecrets()])
      setKeys(k)
      setSecrets(s)
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message })
    }
  }, [])
  useEffect(() => {
    reload()
  }, [reload, chain.account, chain.vaultAddress])

  const act = async (label: string, fn: () => Promise<string>) => {
    setBusy(label)
    setMsg(null)
    try {
      setMsg({ tone: 'ok', text: await fn() })
      await reload()
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }
  return { chain, keys, secrets, busy, msg, act }
}

function Notice({ msg }: { msg: { tone: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  return <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.tone === 'err' ? 'text-[#FF8A5B]' : 'text-lime'}`}>{msg.text}</p>
}

const registered = (keys: PublicKeyRow[], role: PublicKeyRow['role']) => keys.filter((k) => k.role === role)

// ------------------------------------------------------------------ owner

export function SealSecretCard() {
  const { chain, keys, secrets, busy, msg, act } = useEscrow()
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [only, setOnly] = useState<string[]>([]) // empty = every heir
  const threshold = chain.vault?.requiredSignatures ?? 2
  const guardianKeys = registered(keys, 'GUARDIAN')
  const heirKeys = registered(keys, 'HEIR')

  return (
    <Card>
      <h2 className="text-xl font-bold">Seal a secret for your heirs</h2>
      <p className="mt-1 text-sm text-white/60">
        Encrypted in this browser. The key is split so that {threshold} guardians must act, and only after the vault is released on-chain.
        Heirloom's server never sees the secret or enough of the key to open it.
      </p>
      <p className="mt-2 text-xs text-white/55">
        Guardian keys registered: {guardianKeys.length} of {chain.vault?.guardians.length ?? '…'}
        {guardianKeys.length < threshold && ` · at least ${threshold} needed before sealing`}
      </p>
      {!chain.role.owner ? (
        <p className="mt-3 text-sm text-white/60">Connect the vault owner wallet to seal secrets.</p>
      ) : (
        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            act('Sealing', async () => {
              await sealSecret(label.trim(), secret, threshold, only.length ? only : null)
              setLabel('')
              setSecret('')
              setOnly([])
              return `Sealed "${label.trim()}". Only ${threshold} guardians acting after release can open it.`
            })
          }}
        >
          <input className={field} required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Gmail" autoComplete="off" />
          <input className={field} required type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Password or recovery phrase" autoComplete="new-password" />
          <Button disabled={!!busy || guardianKeys.length < threshold}>{busy ? 'Sealing…' : 'Seal'}</Button>
          <fieldset className="md:col-span-3">
            <legend className="text-xs text-white/55">Who can open it? {only.length ? '' : '(every heir)'}</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {heirKeys.length === 0 && <span className="text-xs text-white/45">Heirs appear here once they register their key.</span>}
              {heirKeys.map((h) => (
                <label key={h.address} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={only.includes(h.address)}
                    onChange={() => setOnly((o) => (o.includes(h.address) ? o.filter((x) => x !== h.address) : [...o, h.address]))}
                  />
                  {short(h.address)}
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      )}
      <Notice msg={msg} />
      {secrets.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10 text-sm">
          {secrets.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>{s.label}</span>
              <span className="text-white/55">
                {s.threshold} of {s.held.length} guardians · {s.releasedBy.length} released · for {s.recipients ? s.recipients.map(short).join(', ') : 'every heir'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ guardian

export function GuardianEscrowCard() {
  const v = useVault()
  const { chain, keys, secrets, busy, msg, act } = useEscrow()
  const me = chain.account?.toLowerCase() ?? ''
  const isRegistered = registered(keys, 'GUARDIAN').some((k) => k.address === me) && hasLocalKey(me, 'GUARDIAN')
  const mine = secrets.filter((s) => s.held.some((h) => h.guardian === me))
  const pending = mine.filter((s) => !s.releasedBy.includes(me))

  if (!chain.role.guardian) return null
  return (
    <Card>
      <h2 className="text-xl font-bold">Your key share</h2>
      {!isRegistered ? (
        <>
          <p className="mt-1 text-sm text-white/60">Create your guardian key on this device so the owner can give you a share of their secrets. Your wallet signs once to prove it is you.</p>
          <Button className="mt-3" disabled={!!busy} onClick={() => act('Registering', async () => { await registerKey('GUARDIAN'); return 'Guardian key registered on this device.' })}>
            {busy ? 'Registering…' : 'Register guardian key'}
          </Button>
        </>
      ) : v.state !== 'Executed' ? (
        <p className="mt-1 text-sm text-white/60">
          Key registered. You hold {mine.length} encrypted {mine.length === 1 ? 'share' : 'shares'}. They can only be released after the vault is executed on-chain.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-white/60">The vault has been released on-chain. Pass your shares to the heirs. They are re-encrypted so only the heirs can read them.</p>
          <Button className="mt-3" disabled={!!busy || pending.length === 0} onClick={() => act('Releasing', async () => `Released shares for ${await releaseMyShares(me)} secret(s).`)}>
            {busy ? 'Releasing…' : pending.length ? `Release ${pending.length} share${pending.length > 1 ? 's' : ''} to heirs` : 'All shares released'}
          </Button>
        </>
      )}
      <Notice msg={msg} />
    </Card>
  )
}

// ------------------------------------------------------------------ heir

export function HeirEscrowCard() {
  const v = useVault()
  const { chain, keys, busy, msg, act } = useEscrow()
  const [items, setItems] = useState<Recovered[] | null>(null)
  const me = chain.account?.toLowerCase() ?? ''
  const isRegistered = registered(keys, 'HEIR').some((k) => k.address === me) && hasLocalKey(me, 'HEIR')

  if (!chain.role.heir) return null
  return (
    <Card>
      <h2 className="text-xl font-bold">Sealed secrets</h2>
      {!isRegistered ? (
        <>
          <p className="mt-1 text-sm text-white/60">Create your heir key on this device so guardians can pass you the secrets after release.</p>
          <Button className="mt-3" disabled={!!busy} onClick={() => act('Registering', async () => { await registerKey('HEIR'); return 'Heir key registered on this device.' })}>
            {busy ? 'Registering…' : 'Register heir key'}
          </Button>
        </>
      ) : v.state !== 'Executed' ? (
        <p className="mt-1 text-sm text-white/60">Key registered. Secrets unlock after the vault is released on-chain and enough guardians pass on their shares.</p>
      ) : (
        <>
          <Button className="mt-1" disabled={!!busy} onClick={() => act('Unlocking', async () => { const r = await recoverSecrets(me); setItems(r); return r.length ? 'Done.' : 'No sealed secrets in this vault.' })}>
            {busy ? 'Unlocking…' : 'Unlock secrets'}
          </Button>
          {items && (
            <ul className="mt-4 divide-y divide-white/10 text-sm">
              {items.map((s) => (
                <li key={s.id} className="py-2.5">
                  <b>{s.label}</b>
                  {s.plaintext !== undefined ? (
                    <code className="mt-1 block break-all rounded bg-black/20 px-2 py-1">{s.plaintext}</code>
                  ) : (
                    <span className="block text-xs text-white/55">Waiting for guardians: {s.have} of {s.need} shares released</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Notice msg={msg} />
      {chain.vault && <p className="mt-3 text-xs text-white/45">Vault {short(chain.vault.address)}</p>}
    </Card>
  )
}
