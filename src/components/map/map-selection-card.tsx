import { ArrowRight, Navigation, OctagonAlert } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/score";
import type { Recommendation } from "@/domain/types";
import { windowText } from "@/lib/format";
import { directionsHref } from "@/lib/links";
import { formatDuration } from "@/lib/time";

/** What you tapped on the map, with the two things you can do next. */
export function MapSelectionCard({ rec, detailHref }: { rec: Recommendation; detailHref: string }) {
  return (
    <div className="pointer-events-auto rounded-xl border border-line-strong bg-night-900/95 p-3.5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          <p className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{rec.recommended ? `#${rec.rank} tonight` : "Not recommended"}</p>
          <p className="truncate text-base font-semibold">{rec.location.name}</p>
          {rec.recommended ? (
            <p className="tabular text-xs text-ink-muted">
              {rec.travel.durationMinutes === 0 ? "You're here" : `${formatDuration(rec.travel.durationMinutes)} drive`} · Best {windowText(rec.bestWindow)}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-danger">
              <OctagonAlert aria-hidden className="h-3.5 w-3.5" />
              Road {rec.road.status === "closed" ? "closed" : "difficult"}
            </p>
          )}
        </div>
        <ScoreBadge score={rec.viewingScore} />
      </div>
      <div className={`mt-3 grid gap-2 ${rec.recommended ? "grid-cols-2" : "grid-cols-1"}`}>
        <Link href={detailHref} className={buttonClass({ variant: "glass", size: "sm" })}>
          Details
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
        {rec.recommended && (
          <a href={directionsHref(rec.location.latitude, rec.location.longitude)} target="_blank" rel="noreferrer" className={buttonClass({ variant: "aurora", size: "sm" })}>
            <Navigation aria-hidden className="h-3.5 w-3.5" />
            Directions
          </a>
        )}
      </div>
    </div>
  );
}
