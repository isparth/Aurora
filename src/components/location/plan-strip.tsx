import type { Recommendation } from "@/domain/types";
import { distanceText } from "@/lib/format";
import { planTimes } from "@/lib/plan-time";
import { formatDuration, formatTime } from "@/lib/time";

function Cell({ label, value, sub, accent = false, className = "" }: { label: string; value: string; sub?: string | null; accent?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 bg-night-900/90 p-3.5 ${className}`}>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={`tabular mt-1 text-lg leading-tight font-semibold whitespace-nowrap ${accent ? "text-aurora-300" : "text-ink"}`}>{value}</dd>
      {sub && <dd className="mt-0.5 truncate text-xs text-ink-muted">{sub}</dd>}
    </div>
  );
}

/** Leave / best viewing / drive, with live relative times. Without an origin, travel isn't shown. */
export function PlanStrip({ rec, now, hasOrigin }: { rec: Recommendation; now: number; hasOrigin: boolean }) {
  const { leave, window } = planTimes(rec, now);
  return (
    <dl className={`grid gap-px overflow-hidden rounded-2xl border border-line bg-line ${hasOrigin ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
      {hasOrigin ? (
        <Cell label={leave.label} value={leave.value} sub={leave.sub} accent />
      ) : (
        <Cell label="Be there by" value={rec.bestWindow ? formatTime(rec.bestWindow.start) : "—"} accent />
      )}
      <Cell label="Best viewing" value={window.value} sub={window.sub} />
      {hasOrigin && (
        <Cell
          label="Drive"
          value={rec.travel.durationMinutes === 0 ? "None" : formatDuration(rec.travel.durationMinutes)}
          sub={distanceText(rec.travel)}
          className="col-span-2 sm:col-span-1"
        />
      )}
    </dl>
  );
}
