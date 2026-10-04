import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useB2B2C } from '../lib/b2b2cStore'
import { useVault } from '../lib/vault'

/** Law-firm sign-in (wallet signature) and one-time firm registration, shown to lawyers on Sepolia. */
export function FirmSessionBar() {
  const { role, live } = useB2B2C()
  const { chain } = useVault()
  const { pathname } = useLocation()
  const [name, setName] = useState('')
  const [lawyer, setLawyer] = useState('')
  const [license, setLicense] = useState('')
  if (!live || role !== 'lawyer' || !pathname.startsWith('/lawyer')) return null

  const box = 'mb-5 rounded-xl border border-[#cfe3b8] bg-[#f8faf4] px-4 py-3 text-sm text-[#2b382e]'
  const input = 'rounded-md border border-[#dce4dc] bg-white px-2.5 py-1.5 text-xs'
  const btn = 'rounded-lg bg-[#17221b] px-3 py-1.5 text-xs font-bold text-white hover:bg-black disabled:opacity-40'

  if (!live.firmSignedIn)
    return (
      <div className={box}>
        <b>Law-firm sign-in.</b> The firm's wallet is its identity: sign one message (free) to open the client list.
        <button className={`${btn} ml-3`} disabled={!!live.busy} onClick={live.signInFirm}>
          {live.busy ? 'Check MetaMask…' : chain.account ? 'Sign in with firm wallet' : 'Connect & sign in'}
        </button>
      </div>
    )

  if (!live.firm)
    return (
      <form
        className={box}
        onSubmit={(e) => {
          e.preventDefault()
          live.registerFirm(name.trim(), lawyer.trim(), license.trim() || undefined)
        }}
      >
        <b>Register your firm</b> (once). Vaults you create are recorded on-chain as created by this wallet.
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={input} required minLength={2} placeholder="Firm name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} required minLength={2} placeholder="Lawyer name" value={lawyer} onChange={(e) => setLawyer(e.target.value)} />
          <input className={input} placeholder="Bar licence no. (optional)" value={license} onChange={(e) => setLicense(e.target.value)} />
          <button className={btn} disabled={!!live.busy}>Register firm</button>
        </div>
      </form>
    )

  return (
    <div className={`${box} flex flex-wrap items-center justify-between gap-2`}>
      <span>
        Signed in as <b>{live.firm.name}</b> · {live.firm.lawyerName} · firm wallet {live.firm.wallet.slice(0, 6)}…{live.firm.wallet.slice(-4)}
      </span>
      <button className="text-xs font-semibold text-[#315c3d] underline" onClick={live.signOutFirm}>
        Sign out
      </button>
    </div>
  )
}

/** Progress / error notice for live B2B2C actions. */
export function B2BToast() {
  const { live } = useB2B2C()
  if (!live) return null
  if (live.busy)
    return <div role="status" className="fixed bottom-16 right-4 z-50 rounded-xl bg-[#12261a] px-4 py-3 text-sm text-white shadow-lg">{live.busy}… confirm in MetaMask if asked, then wait for Sepolia.</div>
  if (live.error)
    return (
      <div role="alert" className="fixed bottom-16 right-4 z-50 max-w-sm rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#8a2f28] shadow-lg">
        {live.error}
        <button onClick={live.clearError} className="ml-3 font-semibold underline">Dismiss</button>
      </div>
    )
  return null
}
