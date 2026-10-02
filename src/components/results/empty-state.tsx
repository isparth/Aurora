import { CloudOff, Globe2, MoonStar, Route, Sunrise } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import type { EmptyReason, TravelMode } from "@/domain/types";
import { TRAVEL_MODES } from "@/features/recommendations/travel-modes";
import { resultsHref, type PlaceParams } from "@/lib/links";

const NEXT_MODE: Partial<Record<TravelMode, TravelMode>> = { nearby: "standard", standard: "chase" };

export function EmptyState({ reason, params, travelMode }: { reason: EmptyReason; params: PlaceParams; travelMode: TravelMode }) {
  const wider = NEXT_MODE[travelMode];
  const content: Record<EmptyReason, { icon: typeof Globe2; title: string; body: string }> = {
    "outside-coverage": {
      icon: Globe2,
      title: "Aurora covers Iceland",
      body: "Your location looks to be outside Iceland. Aurora ranks curated, safe viewing spots across Iceland only.",
    },
    "no-darkness": {
      icon: Sunrise,
      title: "No dark skies tonight",
      body: "It doesn't get dark enough to see the aurora here at this time of year. The aurora season in Iceland runs from late August to mid-April.",
    },
    "no-candidates": {
      icon: Route,
      title: `No viewing spots within ${TRAVEL_MODES[travelMode].hint.toLowerCase()}`,
      body: "None of our curated viewing spots are within this drive. Try a longer search radius.",
    },
    "no-forecast": {
      icon: CloudOff,
      title: "Weather forecasts are unavailable",
      body: "We couldn't load cloud forecasts right now, so we can't rank locations honestly. Please try again in a few minutes.",
    },
    "no-window": {
      icon: MoonStar,
      title: "No reachable viewing window left tonight",
      body: "Dawn arrives before you could reach a spot with a usable sky. Check again this evening.",
    },
  };
  const { icon: Icon, title, body } = content[reason];

  return (
    <section role="status" className="rounded-2xl border border-line bg-surface p-6 text-center">
      <Icon aria-hidden className="mx-auto h-8 w-8 text-ink-subtle" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{body}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {reason === "no-candidates" && wider && (
          <Link href={resultsHref({ ...params, mode: wider })} className={buttonClass({ variant: "aurora" })}>
            Search {TRAVEL_MODES[wider].hint.toLowerCase()}
          </Link>
        )}
        {reason === "outside-coverage" && (
          <Link href={resultsHref({ lat: 64.1466, lon: -21.9426, label: "Reykjavík" })} className={buttonClass({ variant: "aurora" })}>
            Use Reykjavík instead
          </Link>
        )}
        {reason === "no-forecast" && (
          <Link href={resultsHref(params)} className={buttonClass({ variant: "aurora" })}>
            Try again
          </Link>
        )}
        <Link href="/" className={buttonClass({ variant: "glass" })}>
          Change location
        </Link>
        {!params.demo && (
          <Link href={resultsHref({ demo: true })} className={buttonClass({ variant: "ghost" })}>
            See the demo night
          </Link>
        )}
      </div>
    </section>
  );
}
