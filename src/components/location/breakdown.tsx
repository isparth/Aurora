import type { ScoreComponents } from "@/domain/types";
import { VIEWING_WEIGHTS } from "@/lib/scoring/viewing-score";

const ROWS: { key: keyof ScoreComponents; label: string; missing: string }[] = [
  { key: "clouds", label: "Clear sky", missing: "" },
  { key: "aurora", label: "Aurora activity", missing: "Forecast unavailable" },
  { key: "darkness", label: "Darkness", missing: "" },
  { key: "lightPollution", label: "Dark surroundings", missing: "" },
  { key: "weather", label: "Weather", missing: "" },
  { key: "camera", label: "Camera evidence", missing: "No camera evidence" },
];

export function ScoreBreakdown({ components, cameraObserved = false }: { components: ScoreComponents; cameraObserved?: boolean }) {
  return (
    <dl className="space-y-3">
      {ROWS.map(({ key, label, missing }) => {
        const value = components[key];
        return (
          <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
            <dt className="flex items-baseline gap-2 text-sm text-ink-muted">
              {label}
              <span className="text-[11px] text-ink-subtle">{Math.round(VIEWING_WEIGHTS[key] * 100)}% weight</span>
            </dt>
            <dd className="tabular text-sm font-medium text-ink">{value === null ? "—" : value}</dd>
            <dd className="col-span-2">
              {value === null ? (
                <span className="text-xs text-ink-subtle">
                  {key === "camera" && cameraObserved
                    ? "Not used for this time — a camera image only informs the next two hours."
                    : `${missing} — its weight is shared by the other factors.`}
                </span>
              ) : (
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-ink/80" style={{ width: `${Math.max(2, value)}%` }} />
                </div>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
