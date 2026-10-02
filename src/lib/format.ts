import type { NightWindow, Recommendation, RoadStatus } from "@/domain/types";

import { formatDuration, formatRange } from "./time";

export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function activityWord(activity: number): string {
  if (activity <= 1) return "Quiet";
  if (activity <= 3) return "Moderate";
  if (activity <= 5) return "Active";
  return "Strong";
}

export const windowText = (w: Recommendation["bestWindow"]) => (w ? formatRange(w.start, w.end) : "—");

export const driveText = (t: Recommendation["travel"]) =>
  t.durationMinutes === 0 ? "You're here" : `${formatDuration(t.durationMinutes)} drive`;

export const distanceText = (t: Recommendation["travel"]) => `${Math.round(t.distanceKm)} km${t.estimated && t.source !== "demo" ? " · estimated" : ""}`;

export const ROAD_TONE: Record<RoadStatus, string> = {
  good: "text-score-excellent",
  caution: "text-warn",
  difficult: "text-danger",
  closed: "text-danger",
  unknown: "text-ink-subtle",
};

/** "20:00–06:50": when it's properly dark tonight (falls back to the twilight-dark night). */
export function darkHours(night: NightWindow | null): string | null {
  if (!night) return null;
  return formatRange(night.darkFrom ?? night.start, night.darkUntil ?? night.end);
}
