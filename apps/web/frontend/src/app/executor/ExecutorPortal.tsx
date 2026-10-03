import { useState } from 'react'
import { useVault } from '../../lib/vault'
import { Button, Card, Locked, Page } from '../../components/ui'

const guides = [
  { title: 'Bank accounts', steps: ['Find the bank and branch in the packet', 'Collect the death certificate and your ID', 'Ask the branch for the claim form for a deceased customer', 'Submit the form. The bank must settle within 15 days of a complete claim'] },
  { title: 'UPI wallets', steps: ['Open the provider support page for deceased users', 'Send the death certificate and your ID', 'Add the nominee or legal heir proof', 'Ask for the balance to be paid to the claimant account'] },
  { title: 'Demat and mutual funds', steps: ['Contact the broker or registrar with the folio number', 'Submit the transmission request with the death certificate', 'Attach the nominee or legal heir documents', 'Link your own demat account to receive units'] },
]

export default function ExecutorPortal() {
  const v = useVault()
  const [done, setDone] = useState<Record<string, boolean>>({})
  const open = v.stage >= 1 || v.state === 'Executed'
  const legal = v.assets.filter((a) => a.kind === 'legal')

  const download = () => {
    const blob = new Blob([JSON.stringify({ generated: new Date().toISOString(), assets: legal.map(({ label, detail }) => ({ label, detail })) }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'legal-heir-packet.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Page title="Executor portal" intro="Your job is to claim assets through the banks and brokers. This packet lists what exists and how to claim it. It holds no passwords.">
      {!open ? (
        <Locked title="The legal packet is still locked" text="It opens at stage 1, after guardians confirm and the owner's veto window ends." />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Legal-heir packet</h2>
                <p className="text-sm text-white/60">{legal.length} accounts and policies listed.</p>
              </div>
              <Button onClick={download}>Download packet</Button>
            </div>
            <ul className="mt-4 divide-y divide-white/10">
              {legal.map((a) => <li key={a.id} className="py-2.5 text-sm">{a.label}<span className="block text-xs text-white/55">{a.detail}</span></li>)}
              {legal.length === 0 && <li className="py-2.5 text-sm text-white/55">The owner has not listed any accounts yet.</li>}
            </ul>
          </Card>

          {guides.map((g) => (
            <Card key={g.title}>
              <h2 className="text-lg font-bold">{g.title}</h2>
              <ul className="mt-3 space-y-2">
                {g.steps.map((s) => {
                  const k = `${g.title}-${s}`
                  return (
                    <li key={k}>
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input type="checkbox" className="mt-0.5 accent-[#7CFF3F]" checked={!!done[k]} onChange={() => setDone({ ...done, [k]: !done[k] })} />
                        <span className={done[k] ? 'text-white/45 line-through' : ''}>{s}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </>
      )}
    </Page>
  )
}
