import type { DataStatus, SourceState } from "@/domain/types";
import { formatTime } from "@/lib/time";

const STATE_LABEL: Record<SourceState, string> = {
  ok: "Live",
  degraded: "Partial",
  unavailable: "Unavailable",
  disabled: "Off",
  demo: "Demo data",
};

const STATE_DOT: Record<SourceState, string> = {
  ok: "bg-score-excellent",
  degraded: "bg-warn",
  unavailable: "bg-danger",
  disabled: "bg-white/25",
  demo: "bg-dusk-300",
};

const SOURCES: { key: keyof DataStatus; name: string; provider: string }[] = [
  { key: "spaceWeather", name: "Geomagnetic activity", provider: "NOAA Space Weather Prediction Center — Kp forecast and real-time estimate" },
  { key: "aurora", name: "Aurora forecast", provider: "Icelandic Meteorological Office (vedur.is) — Kp at midnight" },
  { key: "weather", name: "Cloud & weather", provider: "Open-Meteo" },
  { key: "routing", name: "Drive times", provider: "OSRM / Mapbox, with distance-based fallback" },
  { key: "roads", name: "Road conditions", provider: "IRCA (Vegagerðin) road-condition data service, CC BY 4.0" },
  { key: "cameras", name: "Road cameras", provider: "IRCA (Vegagerðin) webcam data service, CC BY 4.0" },
  { key: "vision", name: "Camera analysis", provider: "Optional multimodal model (supplementary)" },
];

export function DataSources({ status }: { status: DataStatus }) {
  return (
    <details className="group mt-10 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-ink-muted marker:hidden hover:text-ink">
        Data sources &amp; freshness
        <span aria-hidden className="text-ink-subtle transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-2 divide-y divide-line">
        {SOURCES.map(({ key, name, provider }) => {
          const s = status[key];
          return (
            <li key={key} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-ink">{name}</span>
                <span className="block text-xs text-ink-subtle">{provider}</span>
                {s.message && <span className="block text-xs text-ink-subtle">{s.message}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[s.state]}`} />
                {STATE_LABEL[s.state]}
                {s.fetchedAt && s.state !== "demo" ? ` · ${formatTime(s.fetchedAt)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function Notices({ notices }: { notices: string[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Service notices">
      {notices.map((n) => (
        <li key={n} className="rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2.5 text-sm leading-relaxed text-warn">
          {n}
        </li>
      ))}
    </ul>
  );
}
