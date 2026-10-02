import { describe, expect, it } from "vitest";

import { computeRecommendationScore } from "./recommendation-score";

const base = { viewingScore: 85, windowMinutes: 90, driveMinutes: 45, roadStatus: "good" as const, winterAccessConcern: false };

describe("computeRecommendationScore", () => {
  it("prevents recommendation when the road is closed or difficult, whatever the sky", () => {
    expect(computeRecommendationScore({ ...base, viewingScore: 96, roadStatus: "closed" }).recommended).toBe(false);
    expect(computeRecommendationScore({ ...base, viewingScore: 96, roadStatus: "difficult" }).recommended).toBe(false);
    expect(computeRecommendationScore({ ...base, roadStatus: "caution" }).recommended).toBe(true);
    expect(computeRecommendationScore({ ...base, roadStatus: "unknown" }).recommended).toBe(true);
  });

  it("penalises long drives without touching the viewing score", () => {
    const near = computeRecommendationScore({ ...base, driveMinutes: 20 });
    const far = computeRecommendationScore({ ...base, driveMinutes: 140 });
    expect(far.score).toBeLessThan(near.score);
    expect(base.viewingScore).toBe(85);
  });

  it("rewards longer favourable windows", () => {
    const short = computeRecommendationScore({ ...base, windowMinutes: 30 });
    const long = computeRecommendationScore({ ...base, windowMinutes: 180 });
    expect(long.score).toBeGreaterThan(short.score);
  });

  it("prefers verified-good roads over unknown or icy ones", () => {
    const good = computeRecommendationScore(base).score;
    expect(computeRecommendationScore({ ...base, roadStatus: "unknown" }).score).toBeLessThan(good);
    expect(computeRecommendationScore({ ...base, roadStatus: "caution" }).score).toBeLessThan(good);
  });
});
