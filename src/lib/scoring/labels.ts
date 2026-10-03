import type { ActivitySource, RoadStatus, ScoreComponents, ScoreLabel } from "@/domain/types";

/** Labels for a 0–100 chance of seeing the aurora. */
export function scoreLabel(chance: number): ScoreLabel {
  if (chance >= 70) return "Excellent";
  if (chance >= 45) return "Good";
  if (chance >= 20) return "Fair";
  return "Poor";
}

/**
 * A chance as people should read it: to the nearest 5%, never "0%" or "100%" — the model is good to
 * roughly ±10–15 points, and the sky can always surprise.
 */
export function formatChance(chance: number): string {
  if (chance < 5) return "<5%";
  if (chance > 95) return ">95%";
  return `${Math.round(chance / 5) * 5}%`;
}

const OPPORTUNITY: Record<ScoreLabel, string> = {
  Excellent: "Very good chance",
  Good: "Good chance",
  Fair: "Some chance",
  Poor: "Unlikely",
};

export function opportunityLabel(chance: number): string {
  return OPPORTUNITY[scoreLabel(chance)];
}

const TONIGHT: Record<ScoreLabel, string> = {
  Excellent: "Very good chance tonight",
  Good: "Good chance tonight",
  Fair: "Some chance tonight",
  Poor: "Aurora unlikely tonight",
};

export function tonightHeadline(chance: number | null): string {
  return chance === null ? "No viewing window tonight" : TONIGHT[scoreLabel(chance)];
}

export function cloudLabel(fraction: number): string {
  if (fraction <= 0.1) return "Clear";
  if (fraction <= 0.3) return "Mostly clear";
  if (fraction <= 0.6) return "Partly cloudy";
  if (fraction <= 0.85) return "Mostly cloudy";
  return "Overcast";
}

export function lightPollutionLabel(score: number): string {
  if (score >= 0.9) return "Very low";
  if (score >= 0.75) return "Low";
  if (score >= 0.55) return "Moderate";
  return "High";
}

/** Only notable settings get a label; plainer spots aren't called out as such. */
export function sceneryLabel(scenery: number): "Iconic spot" | "Scenic spot" | null {
  if (scenery >= 0.85) return "Iconic spot";
  if (scenery >= 0.65) return "Scenic spot";
  return null;
}

/** How dark the sky is for the aurora, in words: what brightens it and what that means for faint displays. */
export function skyDarknessLabel(c: Pick<ScoreComponents, "brightSky" | "thresholdKr">): { label: string; detail: string } {
  if (c.thresholdKr >= 25) return { label: "Too bright", detail: "Only an exceptional display would show" };
  switch (c.brightSky) {
    case "twilight":
      return { label: "Twilight", detail: c.thresholdKr >= 8 ? "Only bright aurora shows until it gets darker" : "Faint aurora may be lost" };
    case "moon":
      return { label: "Moonlit", detail: c.thresholdKr >= 4 ? "Only moderate or strong aurora will stand out" : "Faint aurora may be lost" };
    case "lights":
      return { label: "Some town glow", detail: "Faint aurora may be lost — face away from the lights" };
    default:
      return { label: "Dark", detail: "Even faint aurora will show" };
  }
}

export const ACTIVITY_SOURCE_LABEL: Record<ActivitySource, string> = {
  nowcast: "Real-time (NOAA)",
  forecast: "NOAA forecast",
  imo: "IMO forecast",
  typical: "Typical night — no forecast",
};

export const ROAD_STATUS_LABEL: Record<RoadStatus, string> = {
  good: "Good",
  caution: "Caution",
  difficult: "Difficult",
  closed: "Closed",
  unknown: "Unavailable",
};
