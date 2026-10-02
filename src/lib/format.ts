import type { NightWindow, Recommendation, RoadStatus } from "@/domain/types";

import { formatDuration, formatRange, formatTime } from "./time";

export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function activityWord(activity: number): string {
  if (activity <= 1) return "Quiet";
  if (activity <= 3) return "Moderate";
  if (activity <= 5) return "Active";
  return "Strong";
}

export const windowText = (w: Recommendation["bestWindow"]) => (w ? formatRange(w.start, w.end) : "—");

export const leaveText = (r: Pick<Recommendation, "leaveNow" | "recommendedDeparture">) =>
  r.leaveNow ? "Leave now" : r.recommendedDeparture ? `Leave around ${formatTime(r.recommendedDeparture)}` : "—";

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

export function darkSkyTile(night: NightWindow | null, now: string): { label: string; value: string } {
  if (!night) return { label: "Dark skies", value: "Not tonight" };
  if (night.darkFrom && Date.parse(night.darkFrom) > Date.parse(now)) return { label: "Dark skies from", value: formatTime(night.darkFrom) };
  if (night.darkUntil) return { label: "Dark skies until", value: formatTime(night.darkUntil) };
  return { label: "Darkness", value: "Twilight only" };
}
