import type { LimitingFactor, Recommendation, RecommendationResponse } from "@/domain/types";

import { formatChance, scoreLabel } from "./scoring/labels";
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
  "no-chance": "Aurora unlikely tonight",
};

const HEADLINE = { Excellent: "Very good chance tonight", Good: "Good chance tonight", Fair: "Some chance tonight", Poor: "Aurora unlikely tonight" };

/** Why the best option is still a long shot, in a few words. */
export const LIMITING_TEXT: Record<LimitingFactor, string> = {
  clouds: "Mostly cloudy nearby",
  activity: "Aurora activity is low tonight",
  "bright-sky": "A bright sky (moon or twilight) hides fainter aurora",
};

/** One-line answer to "can I see the northern lights tonight, and what should I do?". */
export function verdict(data: RecommendationResponse, now: number): { headline: string; summary: string | null } {
  const best = data.recommendations[0];
  if (!best) {
    if (data.notRecommended.length > 0) {
      const wind = data.notRecommended.some((r) => r.blockedBy === "wind");
      const roads = data.notRecommended.some((r) => r.blockedBy !== "wind");
      if (wind && !roads) return { headline: "Storm-force wind at the best spots", summary: "Dangerous gusts are forecast where the chances are good tonight. Please don't risk it." };
      return {
        headline: wind ? "Unsafe conditions at the best spots" : "Unsafe roads to the best spots",
        summary: `The spots with good chances tonight have ${wind ? "dangerous wind or closed roads" : "closed or dangerous roads"}. Please don't risk it.`,
      };
    }
    const reason = data.emptyReason ?? "no-candidates";
    const summary = reason === "no-chance" && data.limitingFactor ? `${LIMITING_TEXT[data.limitingFactor]} at every spot within reach.` : null;
    return { headline: EMPTY_HEADLINE[reason], summary };
  }

  const { leave, window } = planTimes(best, now);
  const label = scoreLabel(best.viewingScore);
  const w = best.bestWindow;
  if (!w) return { headline: HEADLINE[label], summary: null };
  if (window.over) return { headline: "Tonight's best window has passed", summary: "Checking for anything later tonight…" };
  const where =
    label === "Poor"
      ? `${LIMITING_TEXT[data.limitingFactor ?? "clouds"]}. Best bet: ${best.location.name}`
      : `Best chance (${formatChance(best.viewingScore)}) at ${best.location.name}`;
  const when = window.live ? `right now, until ${formatTime(w.end)}` : `from ${formatTime(w.start)} to ${formatTime(w.end)}`;
  const go =
    leave.value === "You're here" ? "You're already there." : leave.value === "Now" ? "Leave now." : leave.value === "—" ? "" : `Leave at ${leave.value} (${leave.sub}).`;
  return { headline: HEADLINE[label], summary: `${where} ${when}. ${go}`.trim() };
}
