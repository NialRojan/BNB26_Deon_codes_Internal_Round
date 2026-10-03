import { useEffect, useState } from 'react'

export function ago(ts: number) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, target - now)
  return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4), s: Math.floor((ms % 6e4) / 1e3), ms }
}

/** Human period for a (possibly fractional) number of days, e.g. 0.0014 -> "2 min", 180 -> "180 days". */
export function period(days: number) {
  const s = Math.round(days * 86400)
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  const d = Math.round(days)
  return `${d} ${d === 1 ? 'day' : 'days'}`
}
