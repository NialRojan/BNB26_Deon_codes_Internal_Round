import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
    <>
    <div className={`${box} flex flex-wrap items-center justify-between gap-2`}>
      <span>
        Signed in as <b>{live.firm.name}</b> · {live.firm.lawyerName} · firm wallet {live.firm.wallet.slice(0, 6)}…{live.firm.wallet.slice(-4)}
      </span>
      <button className="text-xs font-semibold text-[#315c3d] underline" onClick={live.signOutFirm}>
        Sign out
      </button>
    </div>
    <ImportBanner />
    </>
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

/** Vaults this firm wallet created on-chain (e.g. by script) that are not in its client list yet. */
export function ImportBanner() {
  const { live, role } = useB2B2C()
  const { pathname } = useLocation()
  if (!live || role !== 'lawyer' || !live.firm || !live.importable.length || !pathname.startsWith('/lawyer')) return null
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#f1d9a8] bg-[#fffaf0] px-4 py-3 text-sm text-[#5a4a1f]">
      <span>
        The factory records <b>{live.importable.length}</b> vault{live.importable.length === 1 ? '' : 's'} created by this firm wallet that {live.importable.length === 1 ? 'is' : 'are'} not in your client list (
        {live.importable.map((a) => `${a.slice(0, 6)}…${a.slice(-4)}`).join(', ')}).
      </span>
      <button className="rounded-lg bg-[#17221b] px-3 py-1.5 text-xs font-bold text-white hover:bg-black disabled:opacity-40" disabled={!!live.busy} onClick={() => live.importVaults()}>
        {live.busy === 'Import vaults' ? 'Importing… sign in MetaMask' : 'Import into client list'}
      </button>
    </div>
  )
}

/** Shown instead of a lawyer page when the (live) firm has no client vaults yet. */
export function FirmEmptyState() {
  const { live } = useB2B2C()
  if (!live) return null
  const step = !live.firmSignedIn ? 'signin' : !live.firm ? 'register' : 'empty'
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-[#e1e8e1] bg-white p-8 text-center shadow-sm">
      {step === 'signin' && (
        <>
          <h2 className="text-xl font-bold text-[#17221b]">Sign in to see your clients</h2>
          <p className="mt-1 text-sm text-[#718077]">Your client list is tied to the law firm's wallet. Use "Sign in with firm wallet" above (one free signature).</p>
        </>
      )}
      {step === 'register' && (
        <>
          <h2 className="text-xl font-bold text-[#17221b]">Register your firm</h2>
          <p className="mt-1 text-sm text-[#718077]">Fill in the firm details above once. Then create your first client vault.</p>
        </>
      )}
      {step === 'empty' && (
        <>
          <h2 className="text-xl font-bold text-[#17221b]">No clients yet</h2>
          <p className="mt-1 text-sm text-[#718077]">
            Each client vault you create appears here with its live status, guardian votes and timers.
            {live.importable.length > 0 && ' You can also import vaults this wallet already created (banner above).'}
          </p>
          <Link to="/lawyer/create" className="mt-4 inline-block rounded-lg bg-[#a3e635] px-5 py-2.5 text-sm font-bold text-[#17221b] hover:brightness-95">
            + Create your first client vault
          </Link>
        </>
      )}
    </div>
  )
}
