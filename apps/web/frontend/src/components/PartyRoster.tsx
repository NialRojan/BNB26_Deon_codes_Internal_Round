import type { ClientVault } from "../data/mockData";

const short = (a: string) => (/^0x[0-9a-fA-F]{40}$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** Every guardian (with their vote) or every heir (with their share) of a vault; the connected wallet is marked "You". */
export default function PartyRoster({ vault, kind, me }: { vault: ClientVault; kind: "guardian" | "heir"; me?: string | null }) {
  const isMe = (wallet: string) => !!me && wallet.toLowerCase() === me.toLowerCase();
  const rows =
    kind === "guardian"
      ? vault.guardians.map((g) => ({
          id: g.id,
          name: g.name,
          sub: g.role,
          contact: g.contact,
          wallet: g.wallet,
          badge: g.hasAttested ? "Voted" : "Not voted",
          badgeOn: !!g.hasAttested,
        }))
      : vault.heirs.map((h) => ({
          id: h.id,
          name: h.name,
          sub: h.relationship,
          contact: h.contact,
          wallet: h.wallet,
          badge: `${h.percentage}%`,
          badgeOn: true,
        }));

  return (
    <div className="rounded-xl border border-[#e1e8e1] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#edf0ed] pb-3">
        <div>
          <span className="section-kicker">{kind === "guardian" ? "GUARDIAN QUORUM" : "BENEFICIARIES"}</span>
          <h3 className="text-base font-bold text-[#17221b]">
            {kind === "guardian" ? "Guardians" : "Heirs"} of {vault.clientName || "this vault"} ({rows.length})
          </h3>
        </div>
        <span className="text-xs font-semibold text-[#68756c]">
          {kind === "guardian"
            ? `${vault.guardianAttestationsCount} of ${vault.requiredApprovals} approvals needed`
            : `Total ${vault.heirs.reduce((s, h) => s + Number(h.percentage || 0), 0)}%`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="pt-3 text-xs text-[#718077]">No {kind === "guardian" ? "guardians" : "heirs"} recorded for this vault.</p>
      ) : (
        <ul className="divide-y divide-[#edf0ed]">
          {rows.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs ${isMe(r.wallet) ? "-mx-2 rounded-lg bg-[#f8faf4] px-2" : ""}`}>
              <div className="min-w-0">
                <b className="text-sm text-[#17221b]">{r.name}</b>{" "}
                <span className="text-[#718077]">({r.sub})</span>
                {isMe(r.wallet) && <span className="ml-2 rounded bg-[#a3e635] px-1.5 py-0.5 text-[10px] font-bold text-[#17221b]">You</span>}
                <div className="font-mono text-[11px] text-[#869188]" title={r.wallet}>
                  {short(r.wallet)}
                  {r.contact ? ` · ${r.contact}` : ""}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  r.badgeOn ? "bg-[#eaf4df] text-[#276332]" : "bg-[#f5f7f4] text-[#869188]"
                }`}
              >
                {r.badge}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
