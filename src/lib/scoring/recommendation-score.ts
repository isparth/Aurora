import type { RoadStatus } from "@/domain/types";

/** Points subtracted per hour of driving: a better sky is worth a longer drive, up to a point. */
export const DRIVE_PENALTY_PER_HOUR = 6;
/** Points added per hour of favourable window, capped at three hours. */
export const WINDOW_BONUS_PER_HOUR = 2;
/**
 * Spread between the plainest (scenery 0) and most iconic (scenery 1) settings, centred on 0.5.
 * Iconic vs a plain lakeshore (0.4) is worth about 6 points — roughly an hour of extra driving —
 * so a famous backdrop wins when skies are similar, but never beats a clearly better sky.
 */
export const SCENERY_WEIGHT = 10;
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

export type RecommendationInputs = {
  viewingScore: number;
  windowMinutes: number;
  driveMinutes: number;
  roadStatus: RoadStatus;
  winterAccessConcern: boolean;
  /** 0–1 editorial setting rating of the destination. */
  scenery: number;
};

/**
 * Recommendation score: "given where you are, how sensible — and how rewarding — is it to go there?"
 * Kept separate from the viewing score so a destination's sky is never misreported.
 */
export function computeRecommendationScore(inputs: RecommendationInputs): {
  score: number;
  recommended: boolean;
} {
  const recommended = !BLOCKING_ROAD_STATUSES.includes(inputs.roadStatus);
  const score =
    inputs.viewingScore +
    Math.min(inputs.windowMinutes / 60, 3) * WINDOW_BONUS_PER_HOUR -
    (inputs.driveMinutes / 60) * DRIVE_PENALTY_PER_HOUR -
    ROAD_PENALTY[inputs.roadStatus] -
    (inputs.winterAccessConcern ? WINTER_ACCESS_PENALTY : 0) +
    (Math.min(1, Math.max(0, inputs.scenery)) - 0.5) * SCENERY_WEIGHT;
  return { score: Math.round(Math.min(100, Math.max(0, score))), recommended };
}
