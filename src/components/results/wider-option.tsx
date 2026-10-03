import { ArrowRight, Telescope } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import type { TravelMode, WiderOption } from "@/domain/types";
import { TRAVEL_MODES } from "@/features/recommendations/travel-modes";
import { formatChance, sceneryLabel, scoreLabel } from "@/lib/scoring/labels";
import { formatDuration, formatRange } from "@/lib/time";

const SETTING_TEXT = { "Iconic spot": ", an iconic spot,", "Scenic spot": ", a scenic spot,", none: "" } as const;

/** "It's cloudy here, but a much better chance a bit further away" — one tap widens the search. */
export function WiderOptionCard({ option, onWiden, pending }: { option: WiderOption; onWiden: (mode: TravelMode) => void; pending: boolean }) {
  return (
    <section aria-labelledby="wider-title" className="rounded-2xl border border-glacier-300/25 bg-glacier-300/[0.06] p-5">
      <h2 id="wider-title" className="flex items-center gap-2 text-sm font-semibold text-glacier-300">
        <Telescope aria-hidden className="h-4 w-4" />
        A better chance further away
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink">
        <span className="font-semibold">{option.name}</span>
        {SETTING_TEXT[sceneryLabel(option.scenery) ?? "none"]} has a{" "}
        <span className="tabular font-semibold">{formatChance(option.viewingScore)}</span> chance ({scoreLabel(option.viewingScore).toLowerCase()}),{" "}
        <span className="tabular">{formatRange(option.window.start, option.window.end)}</span> — about{" "}
        <span className="tabular">{formatDuration(option.estimatedDriveMinutes)}</span> away.
      </p>
      <button
        type="button"
        onClick={() => onWiden(option.travelMode)}
        disabled={pending}
        className={buttonClass({ variant: "glass", size: "md", className: "mt-4" })}
      >
        Show spots within {TRAVEL_MODES[option.travelMode].phrase}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </button>
    </section>
  );
}
