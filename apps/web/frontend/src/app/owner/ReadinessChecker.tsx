import { useVault } from "../../lib/vault";
import { computeReadiness, type CheckStatus } from "../../lib/readiness";
import { Button, Card, LinkButton, Page } from "../../components/ui";

const label: Record<CheckStatus, string> = {
  pass: "Done",
  warn: "Needs attention",
  fail: "Missing",
};
const color: Record<CheckStatus, string> = {
  pass: "#7CFF3F",
  warn: "#F5B83D",
  fail: "#FF6B4A",
};
const mark: Record<CheckStatus, string> = {
  pass: "M5 12l5 5 9-10",
  warn: "M12 7v6M12 17h.01",
  fail: "M7 7l10 10M17 7L7 17",
};

export default function ReadinessPage() {
  const v = useVault();
  const { checks, score } = computeReadiness(v);

  return (
    <Page
      title="Is your family ready to claim?"
      intro="Most delays come from a missing nominee or an unset legacy contact. Fix these now so heirs are not stuck later."
    >
      <Card>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-5xl font-extrabold">{score}%</div>
            <p className="mt-1 text-sm text-white/60">
              {checks.filter((c) => c.status === "pass").length} of{" "}
              {checks.length} checks done
            </p>
          </div>
          <div
            className="h-2 w-1/2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Readiness score"
          >
            <div className="h-full bg-lime" style={{ width: `${score}%` }} />
          </div>
        </div>
      </Card>

      <ul className="space-y-3">
        {checks.map((c) => (
          <li
            key={c.key}
            className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: color[c.status], color: color[c.status] }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={mark[c.status]} />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.title}</div>
              <div className="text-sm text-white/60">{c.detail}</div>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: color[c.status] }}
            >
              {label[c.status]}
            </span>
            {c.fix && (
              <LinkButton variant="ghost" to={c.fix.to}>
                {c.fix.label}
              </LinkButton>
            )}
            {c.manual && (
              <Button
                variant={v.checklist[c.manual] ? "ghost" : "lime"}
                onClick={() => v.toggleCheck(c.manual!)}
              >
                {v.checklist[c.manual] ? "Undo" : "Mark as done"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Page>
  );
}
