import { ChevronRight, OctagonAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { ScoreBadge } from "@/components/ui/score";
import type { Recommendation } from "@/domain/types";
import { driveText, pct, windowText } from "@/lib/format";

import { Sparkline } from "./sparkline";

export function RankedList({
  items,
  hrefFor,
  selectedId,
  onHighlight,
}: {
  items: Recommendation[];
  hrefFor: (id: string) => string;
  selectedId: string | null;
  onHighlight: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="others-title" className="mt-10">
      <h2 id="others-title" className="text-sm font-semibold text-ink">
        Other options
      </h2>
      <ol className="mt-2 divide-y divide-line border-y border-line">
        {items.map((r) => (
          <li key={r.location.id}>
            <Link
              href={hrefFor(r.location.id)}
              onMouseEnter={() => onHighlight(r.location.id)}
              onFocus={() => onHighlight(r.location.id)}
              className={`group -mx-2 flex items-center gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-white/[0.03] ${
                selectedId === r.location.id ? "bg-white/[0.03]" : ""
              }`}
            >
              <span className="tabular w-5 shrink-0 text-sm text-ink-subtle">{r.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{r.location.name}</span>
                <span className="tabular block text-sm text-ink-muted">
                  {driveText(r.travel).replace(" drive", "")} · {r.conditions ? `${pct(r.conditions.clouds.total)} clouds` : "no forecast"}
                </span>
                <span className="tabular block text-sm text-ink-subtle">Best {windowText(r.bestWindow)}</span>
                {r.road.status === "caution" && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-warn">
                    <TriangleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{r.road.description ?? "Slippery roads reported"}</span>
                  </span>
                )}
              </span>
              <Sparkline hourly={r.hourly} className="hidden shrink-0 opacity-90 sm:block" />
              <ScoreBadge score={r.viewingScore} className="w-10 justify-end" />
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NotRecommendedList({ items, hrefFor }: { items: Recommendation[]; hrefFor: (id: string) => string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="blocked-title" className="mt-10">
      <h2 id="blocked-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <OctagonAlert aria-hidden className="h-4 w-4 text-danger" />
        Not recommended tonight
      </h2>
      <p className="mt-1 text-sm text-ink-subtle">Good skies, but road conditions make the drive unsafe. Sky quality never overrides a road warning.</p>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {items.map((r) => (
          <li key={r.location.id}>
            <Link href={hrefFor(r.location.id)} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-4 hover:bg-white/[0.03]">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{r.location.name}</span>
                <span className="mt-0.5 block text-sm text-danger">
                  Road {r.road.status === "closed" ? "closed" : "difficult"}
                  {r.road.description ? ` — ${r.road.description}` : ""}
                </span>
              </span>
              <span className="tabular shrink-0 text-right text-sm text-ink-subtle">
                Sky {r.viewingScore}
                <span className="block text-xs">Not recommended</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
