import { useVault } from '../lib/vault'
import { addrUrl, short, txUrl } from '../lib/chain'

/** Wallet connect button + the connected wallet's role in the vault. Sits in the top bar. */
export function WalletButton() {
  const { live, chain } = useVault()
  if (!live) return <span className="secure-indicator"><i /> Local demo state</span>
  if (!chain.account)
    return (
      <button onClick={chain.connect} className="rounded-lg border border-[#cfe3b8] bg-white px-3 py-2 text-xs font-semibold text-[#315c3d] hover:bg-[#f3f9ec]">
        Connect wallet
      </button>
    )
  const roles = Object.entries(chain.role).filter(([, on]) => on).map(([r]) => r)
  return (
    <a href={addrUrl(chain.account)} target="_blank" rel="noreferrer" className="secure-indicator" title="Connected wallet on Sepolia">
      <i /> {short(chain.account)} · {roles.length ? roles.join(', ') : 'no role in this vault'}
    </a>
  )
}

/** Pending-transaction, error and success notices for on-chain actions. */
export function TxToast() {
  const { live, chain } = useVault()
  if (!live) return null
  if (chain.busy)
    return <div role="status" className="fixed bottom-4 right-4 z-50 rounded-xl bg-[#12261a] px-4 py-3 text-sm text-white shadow-lg">{chain.busy}… confirm in your wallet, then wait for the block.</div>
  if (chain.error)
    return (
      <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#8a2f28] shadow-lg">
        {chain.error}
        <button onClick={chain.clearError} className="ml-3 font-semibold underline">Dismiss</button>
      </div>
    )
  if (chain.lastTx)
    return (
      <a href={txUrl(chain.lastTx)} target="_blank" rel="noreferrer" className="fixed bottom-4 right-4 z-50 rounded-xl bg-[#e9f4e8] px-4 py-3 text-sm text-[#2c5e35] shadow-lg">
        Confirmed on Sepolia. View transaction ↗
      </a>
    )
  return null
}
