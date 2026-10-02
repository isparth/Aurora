import type { RoadStatus, ScoreLabel } from "@/domain/types";

export function scoreLabel(score: number): ScoreLabel {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Poor";
}

const OPPORTUNITY: Record<ScoreLabel, string> = {
  Excellent: "Excellent opportunity",
  Good: "Promising",
  Fair: "Possible",
  Poor: "Poor conditions",
};

export function opportunityLabel(score: number): string {
  return OPPORTUNITY[scoreLabel(score)];
}

const TONIGHT: Record<ScoreLabel, string> = {
  Excellent: "Excellent tonight",
  Good: "Promising tonight",
  Fair: "Possible tonight",
  Poor: "Poor tonight",
};

export function tonightHeadline(score: number | null): string {
  return score === null ? "No viewing window tonight" : TONIGHT[scoreLabel(score)];
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

export function darknessQualityLabel(darkness: number): string {
  if (darkness >= 0.9) return "Excellent";
  if (darkness >= 0.7) return "Good";
  if (darkness >= 0.4) return "Twilight";
  return "Too bright";
}

export const ROAD_STATUS_LABEL: Record<RoadStatus, string> = {
  good: "Good",
  caution: "Caution",
  difficult: "Difficult",
  closed: "Closed",
  unknown: "Unavailable",
};
