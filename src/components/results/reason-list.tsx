import { AlertTriangle, Check } from "lucide-react";

export function ReasonList({ reasons, warnings, title = "Why this place?" }: { reasons: string[]; warnings: string[]; title?: string }) {
  return (
    <div>
      {reasons.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <ul className="mt-2.5 space-y-2">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
                <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-aurora-300" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {warnings.length > 0 && (
        <ul className={`${reasons.length > 0 ? "mt-4" : ""} space-y-2`} aria-label="Things to watch">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2.5 text-sm leading-relaxed text-warn">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
