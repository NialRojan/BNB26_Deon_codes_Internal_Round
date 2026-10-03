import { useState } from 'react'
import { useVault } from '../../lib/vault'
import { Button, Card, Page } from '../../components/ui'

type Vote = 'deceased' | 'incapacitated' | 'unsure'
const options: { id: Vote; label: string }[] = [
  { id: 'deceased', label: 'I believe the owner has died' },
  { id: 'incapacitated', label: 'I believe the owner cannot act for themselves' },
  { id: 'unsure', label: 'I cannot confirm this' },
]

export default function GuardianPortal() {
  const v = useVault()
  const [vote, setVote] = useState<Vote | null>(null)
  const [sent, setSent] = useState(false)
  const pending = v.state === 'TriggerPending' || v.state === 'VetoWindow'

  const submit = () => {
    if (!vote) return
    setSent(true)
    v.log(`A guardian submitted an attestation. Votes stay hidden until ${v.k} are in.`, 'warn')
  }

  return (
    <Page title="Guardian portal" intro="You were chosen because the vault owner trusts your judgment. You hold one share of the key and cannot open anything on your own.">
      <Card>
        <div className="flex items-center gap-2 text-sm text-white/65">
          <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />
          Signed in on this device. Your attestations only work from here.
        </div>
      </Card>

      {!pending ? (
        <Card className="text-center">
          <h2 className="text-xl font-bold">No recovery requests</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/60">You will be notified here and by message if someone opens one. There is nothing for you to do now.</p>
        </Card>
      ) : sent ? (
        <Card>
          <h2 className="text-xl font-bold">Attestation submitted</h2>
          <p className="mt-1 text-sm text-white/60">Thank you. Your answer stays private until {v.k} guardians have responded. The owner can still cancel during the veto window.</p>
        </Card>
      ) : (
        <Card>
          <h2 className="text-xl font-bold">Recovery request waiting for you</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div><dt className="text-white/55">Opened by</dt><dd className="font-semibold">A guardian</dd></div>
            <div><dt className="text-white/55">Evidence</dt><dd className="font-semibold">Death certificate verified</dd></div>
            <div><dt className="text-white/55">Needed</dt><dd className="font-semibold">{v.k} guardians</dd></div>
          </dl>
          <fieldset className="mt-5 space-y-2">
            <legend className="text-sm font-semibold">What do you know?</legend>
            {options.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${vote === o.id ? 'border-lime bg-lime/10' : 'border-white/15'}`}>
                <input type="radio" name="vote" className="accent-[#7CFF3F]" checked={vote === o.id} onChange={() => setVote(o.id)} />
                {o.label}
              </label>
            ))}
          </fieldset>
          <p className="mt-3 text-xs text-white/55">You will not see how other guardians answered. This keeps anyone from simply following the group.</p>
          <Button className="mt-4" disabled={!vote} onClick={submit}>Submit attestation</Button>
        </Card>
      )}
    </Page>
  )
}
