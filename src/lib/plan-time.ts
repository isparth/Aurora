import type { Recommendation, RecommendationResponse } from "@/domain/types";

import { scoreLabel } from "./scoring/labels";
import { formatDuration, formatTime, MINUTE } from "./time";

type PlanInput = Pick<Recommendation, "bestWindow" | "recommendedDeparture" | "leaveNow" | "travel">;

export type PlanTimes = {
  leave: { label: string; value: string; sub: string | null; urgent: boolean };
  window: { value: string; sub: string | null; live: boolean; over: boolean };
};

const minutesBetween = (a: number, b: number) => (b - a) / MINUTE;

/** The plan in the words a traveller needs right now: "Leave at 20:35 · in 55 min", "Now – 01:30". */
export function planTimes(rec: PlanInput, now: number): PlanTimes {
  const w = rec.bestWindow;
  const start = w ? Date.parse(w.start) : null;
  const end = w ? Date.parse(w.end) : null;

  let window: PlanTimes["window"] = { value: "—", sub: null, live: false, over: false };
  if (start !== null && end !== null) {
    const range = `${formatTime(start)}–${formatTime(end)}`;
    if (now >= end) window = { value: range, sub: "This window has passed", live: false, over: true };
    else if (now >= start) window = { value: `Now – ${formatTime(end)}`, sub: `for another ${formatDuration(minutesBetween(now, end))}`, live: true, over: false };
    else window = { value: range, sub: `starts in ${formatDuration(minutesBetween(now, start))}`, live: false, over: false };
  }

  let leave: PlanTimes["leave"];
  const departure = rec.recommendedDeparture ? Date.parse(rec.recommendedDeparture) : null;
  if (window.over) {
    leave = { label: "Leave", value: "—", sub: "Tonight's best window has passed", urgent: false };
  } else if (rec.travel.durationMinutes === 0) {
    leave = { label: "Where", value: "You're here", sub: window.live ? "Look up now" : null, urgent: false };
  } else if (departure === null || start === null) {
    leave = { label: "Leave", value: "—", sub: null, urgent: false };
  } else if (rec.leaveNow || departure <= now) {
    leave = { label: "Leave", value: "Now", sub: window.live ? "The clear spell has started" : `to be there by ${formatTime(start)}`, urgent: true };
  } else {
    const wait = minutesBetween(now, departure);
    leave = { label: "Leave at", value: formatTime(departure), sub: `in ${formatDuration(wait)}`, urgent: wait <= 15 };
  }
  return { leave, window };
}

const EMPTY_HEADLINE: Record<NonNullable<RecommendationResponse["emptyReason"]>, string> = {
  "outside-coverage": "Outside Iceland",
  "no-darkness": "Too bright for aurora tonight",
  "no-candidates": "No viewing spots within reach",
  "no-forecast": "Forecast temporarily unavailable",
  "no-window": "No viewing window left tonight",
};

const HEADLINE = { Excellent: "Great conditions tonight", Good: "Good chance tonight", Fair: "Possible tonight", Poor: "Poor conditions tonight" };

/** One-line answer to "can I see the northern lights tonight, and what should I do?". */
export function verdict(data: RecommendationResponse, now: number): { headline: string; summary: string | null } {
  const best = data.recommendations[0];
  if (!best) {
    if (data.notRecommended.length > 0) {
      return { headline: "Unsafe roads to the clear spots", summary: "The spots with good skies tonight have closed or dangerous roads. Please don't risk it." };
    }
    return { headline: EMPTY_HEADLINE[data.emptyReason ?? "no-candidates"], summary: null };
  }

  const { leave, window } = planTimes(best, now);
  const label = scoreLabel(best.viewingScore);
  const w = best.bestWindow;
  if (!w) return { headline: HEADLINE[label], summary: null };
  if (window.over) return { headline: "Tonight's best window has passed", summary: "Checking for anything later tonight…" };
  const where = label === "Poor" ? `Mostly cloudy nearby. Best bet: ${best.location.name}` : `Clearest at ${best.location.name}`;
  const when = window.live ? `right now, until ${formatTime(w.end)}` : `from ${formatTime(w.start)} to ${formatTime(w.end)}`;
  const go =
    leave.value === "You're here" ? "You're already there." : leave.value === "Now" ? "Leave now." : leave.value === "—" ? "" : `Leave at ${leave.value} (${leave.sub}).`;
  return { headline: HEADLINE[label], summary: `${where} ${when}. ${go}`.trim() };
}
