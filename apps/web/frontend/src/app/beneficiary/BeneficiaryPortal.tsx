import { useState } from 'react'
import { useVault } from '../../lib/vault'
import { Button, Card, field, Locked, Page } from '../../components/ui'
import { formatEther } from 'viem'

export default function BeneficiaryPortal() {
  const v = useVault()
  const [shares, setShares] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [merged, setMerged] = useState(false)
  const kitOpen = v.stage >= 2 || v.state === 'Executed'
  const cryptoOpen = v.stage >= 3 || v.state === 'Executed'
  const kit = v.assets.filter((a) => a.kind === 'access')

  const addShare = () => {
    if (!draft.trim()) return
    setShares([...shares, draft.trim()]); setDraft('')
  }

  const { live, chain } = v
  const share = chain.vault?.beneficiaries.find((b) => b.wallet.toLowerCase() === chain.account?.toLowerCase())

  return (
    <Page title="Heir portal" intro="What you can open depends on your tier and the current release stage. Crypto always opens last.">
      {live && (
        <>
          <h2 className="text-xl font-bold">On-chain inheritance</h2>
          {v.state !== 'Executed' ? (
            <Locked title="The vault has not been released" text="ETH unlocks after guardians confirm and the owner's veto window ends." />
          ) : !chain.account ? (
            <Card>
              <p className="text-sm text-white/60">Connect the wallet the owner named as your beneficiary wallet.</p>
              <Button className="mt-3" onClick={chain.connect}>Connect wallet</Button>
            </Card>
          ) : !share ? (
            <Card><p className="text-sm text-white/60">The connected wallet is not a beneficiary of this vault. Switch accounts in MetaMask.</p></Card>
          ) : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">Your share: {share.bps / 100}% of the vault</p>
                  <p className="text-2xl font-bold">{chain.hasClaimed ? 'Claimed' : `${formatEther(chain.claimable)} ETH`}</p>
                  <p className="text-xs text-white/55">Sent straight to your wallet. Nobody else can redirect it.</p>
                </div>
                <Button disabled={chain.hasClaimed || chain.claimable === 0n || !!chain.busy} onClick={chain.claimEth}>
                  {chain.busy === 'Claiming' ? 'Claiming…' : chain.hasClaimed ? 'Already claimed' : 'Claim ETH'}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <h2 className="text-xl font-bold">Recovery kit</h2>
      {!kitOpen ? (
        <Locked title="The recovery kit is still locked" text="It opens at stage 2, after a further timelock." />
      ) : (
        <Card>
          <ul className="divide-y divide-white/10">
            {kit.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{a.label}<span className="block text-xs text-white/55">{a.detail}</span></span>
                <Button variant="ghost">Open item</Button>
              </li>
            ))}
            {kit.length === 0 && <li className="py-2.5 text-sm text-white/55">No access kit items were added.</li>}
          </ul>
        </Card>
      )}

      <h2 className="pt-4 text-xl font-bold">Crypto vault</h2>
      {!cryptoOpen ? (
        <Locked title="The crypto vault is still locked" text="It opens at stage 3, after a second verification and the final timelock." />
      ) : (
        <Card>
          <p className="text-sm text-white/60">Enter {v.k} key shares to rebuild the vault key. Shares never leave this browser.</p>
          <div className="mt-4 flex gap-3">
            <input className={field} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste one share" autoComplete="off" />
            <Button onClick={addShare}>Add share</Button>
          </div>
          <div className="mt-4 flex items-center gap-1.5" aria-label={`${shares.length} of ${v.k} shares entered`}>
            {Array.from({ length: v.k }).map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < shares.length ? 'bg-lime' : 'bg-white/15'}`} />)}
          </div>
          <p className="mt-2 text-xs text-white/55">{shares.length} of {v.k} shares entered</p>
          <Button className="mt-4" disabled={shares.length < v.k || merged} onClick={() => { setMerged(true); v.log('Crypto shards merged on the heir device.', 'warn') }}>
            {merged ? 'Vault key rebuilt' : 'Rebuild vault key'}
          </Button>
        </Card>
      )}
    </Page>
  )
}
