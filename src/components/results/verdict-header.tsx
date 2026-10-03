import { Loader2, MoonStar, RefreshCw, Sparkles } from "lucide-react";

import { AuroraActivityTip } from "@/components/ui/glossary";
import type { RecommendationResponse } from "@/domain/types";
import { activityWord, darkHours, kpText } from "@/lib/format";
import { verdict } from "@/lib/plan-time";
import { formatRelative, formatTime } from "@/lib/time";

/** "Kp 0.3 now · up to ~3.3 around 23:30" — the real-time level first, then what the forecast expects. */
function activityChipText(aurora: RecommendationResponse["aurora"]): { strong: string; rest: string } | null {
  const { kpNow, kpPeak, activity } = aurora;
  const later = kpPeak && (kpNow === null || kpPeak.kp >= kpNow + 0.7) ? ` · up to ~${kpText(kpPeak.kp)} around ${formatTime(kpPeak.time)}` : "";
  if (kpNow !== null) return { strong: `Kp ${kpText(kpNow)}`, rest: ` now · ${activityWord(kpNow)}${later}` };
  if (activity !== null) return { strong: `Kp ${kpText(activity)}`, rest: ` forecast (IMO) · ${activityWord(activity)}` };
  if (kpPeak) return { strong: `Kp ~${kpText(kpPeak.kp)}`, rest: ` forecast · ${activityWord(kpPeak.kp)}` };
  return null;
}

const chip = "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs text-ink-muted";

/** The answer first: can I see the aurora tonight, where, and when to leave. */
export function VerdictHeader({
  data,
  now,
  onRefresh,
  refreshing,
}: {
  data: RecommendationResponse;
  now: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { headline, summary } = verdict(data, now);
  const activity = data.aurora.available ? activityChipText(data.aurora) : null;
  const dark = darkHours(data.night);
  const updated = formatRelative(data.generatedAt, now);

  return (
    <header>
      <p className="text-sm text-ink-subtle">Tonight near {data.origin.label}</p>
      <h1 className="mt-1 text-[1.9rem] leading-[1.15] font-semibold tracking-tight text-balance">{headline}</h1>
      {summary && <p className="mt-2 text-[15px] leading-relaxed text-pretty text-ink-muted">{summary}</p>}

      <ul className={`mt-4 flex flex-wrap gap-2 ${data.emptyReason === "outside-coverage" ? "hidden" : ""}`} aria-label="Tonight's conditions">
        <li className={chip}>
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-aurora-300" />
          {activity ? (
            <span>
              Activity <span className="tabular font-semibold text-ink">{activity.strong}</span>
              {activity.rest}
            </span>
          ) : (
            <span>Activity forecast unavailable</span>
          )}
          <AuroraActivityTip />
        </li>
        {dark && (
          <li className={chip}>
            <MoonStar aria-hidden className="h-3.5 w-3.5 text-glacier-300" />
            <span>
              Dark <span className="tabular font-semibold text-ink">{dark}</span>
            </span>
          </li>
        )}
        {!data.demo && (
          <li>
            <button type="button" onClick={onRefresh} disabled={refreshing} className={`${chip} hover:text-ink disabled:opacity-70`}>
              {refreshing ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw aria-hidden className="h-3.5 w-3.5" />}
              <span>{refreshing ? "Updating…" : `Updated ${updated}`}</span>
              <span className="sr-only">— refresh now</span>
            </button>
          </li>
        )}
      </ul>
    </header>
  );
}
