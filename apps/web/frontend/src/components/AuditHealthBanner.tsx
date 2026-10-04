import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'
type Issue = { severity: 'critical' | 'warning'; message: string }

/** The audit log runs in the backend; this shows something only when there is a real problem with it. */
export default function AuditHealthBanner() {
  const [issues, setIssues] = useState<Issue[]>([])
  useEffect(() => {
    let alive = true
    const check = () =>
      fetch(`${API}/audit/health`)
        .then((r) => r.json())
        .then((j) => alive && setIssues(j?.data?.issues ?? []))
        .catch(() => alive && setIssues([]))
    check()
    const t = setInterval(check, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  if (!issues.length) return null
  const critical = issues.some((i) => i.severity === 'critical')
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${critical ? 'border-[#f3b4ad] bg-[#fff0ed] text-[#8a2f28]' : 'border-[#f1d9a8] bg-[#fffaf0] text-[#5a4a1f]'}`}>
      <b>{critical ? 'Audit log integrity problem' : 'Audit log needs attention'}</b>
      <ul className="mt-1 list-disc pl-5 text-xs">
        {issues.map((i) => (
          <li key={i.message}>{i.message}</li>
        ))}
      </ul>
    </div>
  )
}
