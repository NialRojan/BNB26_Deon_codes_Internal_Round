import { useVault } from '../lib/vault'
import { useCountdown } from '../lib/time'

export default function VetoBanner() {
  const v = useVault()
  const c = useCountdown(v.vetoEndsAt)
  if (v.state !== 'TriggerPending' && v.state !== 'VetoWindow') return null
  return (
    <div role="alert" className="sticky top-0 z-30 bg-[#FF6B4A] text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div>
          <p className="font-bold">Someone started recovery on your vault.</p>
          <p className="text-sm">
            {v.vetoEndsAt ? (c.ms === 0 ? 'The veto window has ended. Anyone can now execute the release.' : `Release begins in ${c.d}d ${c.h}h ${c.m}m ${c.s}s unless you cancel.`) : 'Guardians are reviewing the request.'}
            {v.risk >= 60 && ' The timer was extended after unusual guardian activity.'}
          </p>
        </div>
        {v.live && v.vetoEndsAt && c.ms === 0 ? (
          <button onClick={v.advance} className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-black">
            Veto window over. Execute release.
          </button>
        ) : (
          <button onClick={v.cancelRecovery} className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-black">
            Cancel recovery. I am safe.
          </button>
        )}
      </div>
    </div>
  )
}
