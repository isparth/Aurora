import { ExternalLink } from "lucide-react";

import type { RoadSafety } from "@/domain/types";
import { ROAD_TONE } from "@/lib/format";
import { ROAD_STATUS_LABEL } from "@/lib/scoring/labels";
import { formatTime } from "@/lib/time";

const COVERAGE: Record<RoadSafety["coverage"], string> = {
  route: "Matched along your driving route.",
  destination: "Roads near the destination only — the full route could not be checked.",
  none: "No official road-condition reports cover this drive.",
};

export function RoadCard({ road }: { road: RoadSafety }) {
  return (
    <section aria-labelledby="road-title" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="road-title" className="text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
        Road conditions
      </h2>
      <p className={`mt-2 text-lg font-semibold ${ROAD_TONE[road.status]}`}>
        {road.status === "unknown" ? "Road conditions unavailable" : ROAD_STATUS_LABEL[road.status]}
      </p>
      {road.description && <p className="mt-0.5 text-sm text-ink-muted">{road.description}</p>}
      {road.status === "unknown" && <p className="mt-1 text-sm text-warn">Check official road information before you travel.</p>}
      {road.segments.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {road.segments.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 py-2">
              <span className="text-ink-muted">{s.name}</span>
              <span className={`shrink-0 text-right ${ROAD_TONE[s.status]}`}>{s.description}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-subtle">
        {COVERAGE[road.coverage]}
        {road.source === "irca" && road.fetchedAt
          ? ` Source: Icelandic Road and Coastal Administration road-condition data service, retrieved ${formatTime(road.fetchedAt)} (CC BY 4.0).`
          : ""}
      </p>
      <a
        href="https://umferdin.is/en"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        Official road map (umferdin.is)
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      </a>
    </section>
  );
}
