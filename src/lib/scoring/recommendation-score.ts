import type { RoadStatus } from "@/domain/types";

import { clamp01, smoothstep } from "./math";

/**
 * Trip value: "given where you are, how worthwhile is it to go there tonight?" It starts from the chance of
 * seeing the aurora (percentage points) and subtracts what the trip costs, so the units stay meaningful —
 * one hour of driving each way is worth about eight points of chance. Kept separate from the chance itself
 * so a destination's sky is never misreported.
 */
export const DRIVE_COST_PER_HOUR = 8;
/** Long night drives cost extra (fatigue, getting home at 4 a.m.): quadratic beyond 1.5 hours each way. */
export const LONG_DRIVE_AFTER_HOURS = 1.5;
export const LONG_DRIVE_COST = 4;
/**
 * A sighting above an iconic backdrop is worth up to 10% more, above a plain spot (0.4) ~2% less. It scales
 * with the chance, so a famous view never compensates for a sky where you won't see anything.
 */
export const SCENERY_VALUE = 0.2;
export const ROAD_PENALTY: Record<RoadStatus, number> = {
  good: 0,
  unknown: 2,
  caution: 6,
  difficult: 0,
  closed: 0,
};
export const WINTER_ACCESS_PENALTY = 8;

/** Road states that are a hard safety constraint: sky quality can never override them. */
export const BLOCKING_ROAD_STATUSES: readonly RoadStatus[] = ["difficult", "closed"];
/** Gusts (m/s) at the destination from which a trip is not recommended (Safetravel: postpone travel at 25–30 m/s). */
export const BLOCKING_GUST_MS = 30;

export function driveCost(minutes: number): number {
  const hours = minutes / 60;
  return DRIVE_COST_PER_HOUR * hours + LONG_DRIVE_COST * Math.max(0, hours - LONG_DRIVE_AFTER_HOURS) ** 2;
}

/** Strong gusts make the drive and standing outside hazardous: about −4 at 20 m/s, −15 from 25 m/s. */
export function windPenalty(gustMs: number): number {
  return 4 * smoothstep(17, 21, gustMs) + 11 * smoothstep(22, 26, gustMs);
}

export type RecommendationInputs = {
  /** 0–100 chance of seeing the aurora during the window. */
  chance: number;
  driveMinutes: number;
  roadStatus: RoadStatus;
  winterAccessConcern: boolean;
  /** 0–1 editorial setting rating of the destination. */
  scenery: number;
  /** Strongest gust forecast at the destination during the window, km/h. */
  maxGustKph?: number;
};

export function computeRecommendationScore(inputs: RecommendationInputs): {
  score: number;
  recommended: boolean;
  blockedBy: "road" | "wind" | null;
} {
  const gustMs = (inputs.maxGustKph ?? 0) / 3.6;
  const blockedBy = BLOCKING_ROAD_STATUSES.includes(inputs.roadStatus) ? "road" : gustMs >= BLOCKING_GUST_MS ? "wind" : null;
  const score =
    inputs.chance * (1 + SCENERY_VALUE * (clamp01(inputs.scenery) - 0.5)) -
    driveCost(inputs.driveMinutes) -
    ROAD_PENALTY[inputs.roadStatus] -
    (inputs.winterAccessConcern ? WINTER_ACCESS_PENALTY : 0) -
    windPenalty(gustMs);
  return { score: Math.round(score * 10) / 10, recommended: blockedBy === null, blockedBy };
}
