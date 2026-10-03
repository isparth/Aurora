import type { NightWindow, Recommendation, RoadStatus } from "@/domain/types";

import { formatDuration, formatRange } from "./time";

export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Kp in words; Kp 5 and above is a geomagnetic storm on NOAA's scale. */
export function activityWord(kp: number): string {
  if (kp < 1.5) return "Quiet";
  if (kp < 3.5) return "Moderate";
  if (kp < 5) return "Active";
  return "Storm";
}

/** "2.7" / "3" — Kp with at most one decimal. */
export const kpText = (kp: number) => (Math.round(kp * 10) / 10).toString();

export const windowText = (w: Recommendation["bestWindow"]) => (w ? formatRange(w.start, w.end) : "—");

/** Why a spot is ruled out tonight, in a few words. */
export function blockedText(r: Pick<Recommendation, "blockedBy" | "road">): string {
  if (r.blockedBy === "wind") return "Storm-force gusts forecast";
  return `Road ${r.road.status === "closed" ? "closed" : "difficult"}${r.road.description ? ` — ${r.road.description}` : ""}`;
}

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
