import { describe, expect, it } from "vitest";

import { computeRecommendationScore } from "./recommendation-score";

const base = { viewingScore: 85, windowMinutes: 90, driveMinutes: 45, roadStatus: "good" as const, winterAccessConcern: false, scenery: 0.5 };

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

  describe("scenery", () => {
    const iconic = { ...base, scenery: 1 };
    const plain = { ...base, scenery: 0.4 };

    it("prefers an iconic setting when the skies are similar", () => {
      expect(computeRecommendationScore({ ...iconic, viewingScore: 84 }).score).toBeGreaterThan(computeRecommendationScore({ ...plain, viewingScore: 86 }).score);
    });

    it("is worth about an hour of extra driving, not more", () => {
      expect(computeRecommendationScore({ ...iconic, driveMinutes: 90 }).score).toBeGreaterThan(computeRecommendationScore({ ...plain, driveMinutes: 45 }).score);
      expect(computeRecommendationScore({ ...iconic, driveMinutes: 150 }).score).toBeLessThan(computeRecommendationScore({ ...plain, driveMinutes: 45 }).score);
    });

    it("never beats a clearly better sky", () => {
      expect(computeRecommendationScore({ ...iconic, viewingScore: 75 }).score).toBeLessThan(computeRecommendationScore({ ...plain, viewingScore: 85 }).score);
    });

    it("never makes an unsafe road acceptable", () => {
      expect(computeRecommendationScore({ ...iconic, viewingScore: 96, roadStatus: "closed" }).recommended).toBe(false);
    });
  });
});
