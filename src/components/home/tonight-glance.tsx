import { MoonStar, Sparkles, Sunrise } from "lucide-react";

import type { TonightGlance as Glance } from "@/features/recommendations/service";
import { activityWord } from "@/lib/format";
import { formatTime } from "@/lib/time";

/** Sets expectations before anyone types: is it even dark tonight, and how active is the aurora? */
export function TonightGlance({ glance }: { glance: Glance }) {
  if (!glance.dark) {
    return (
      <p className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink-muted">
        <Sunrise aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <span>
          Iceland&apos;s nights are too bright for the northern lights right now. The season runs from late August to mid-April.
        </span>
      </p>
    );
  }
  return (
    <ul className="mt-6 flex flex-wrap gap-2 text-sm text-ink-muted" aria-label="Tonight in Iceland">
      {glance.activity !== null && (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-aurora-300" />
          Aurora forecast tonight <span className="font-semibold text-ink">Kp {glance.activity}</span> · {activityWord(glance.activity)}
        </li>
      )}
      <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
        <MoonStar aria-hidden className="h-3.5 w-3.5 text-glacier-300" />
        Dark from <span className="tabular font-semibold text-ink">{formatTime(glance.dark.from)}</span> in Reykjavík
      </li>
    </ul>
  );
}
