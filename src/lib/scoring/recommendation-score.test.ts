import { describe, expect, it } from "vitest";

import { BLOCKING_GUST_MS, computeRecommendationScore, driveCost, windPenalty, type RecommendationInputs } from "./recommendation-score";

const base: RecommendationInputs = { chance: 60, driveMinutes: 45, roadStatus: "good", winterAccessConcern: false, scenery: 0.5 };
const score = (overrides: Partial<RecommendationInputs> = {}) => computeRecommendationScore({ ...base, ...overrides }).score;

describe("computeRecommendationScore", () => {
  it("prevents recommendation when the road is closed or difficult, whatever the chance", () => {
    expect(computeRecommendationScore({ ...base, chance: 96, roadStatus: "closed" })).toMatchObject({ recommended: false, blockedBy: "road" });
    expect(computeRecommendationScore({ ...base, chance: 96, roadStatus: "difficult" }).recommended).toBe(false);
    expect(computeRecommendationScore({ ...base, roadStatus: "caution" }).recommended).toBe(true);
    expect(computeRecommendationScore({ ...base, roadStatus: "unknown" }).recommended).toBe(true);
  });

  it("is worth a longer drive for a clearly better chance, but not for a marginal one", () => {
    expect(score({ chance: 45, driveMinutes: 150 })).toBeGreaterThan(score({ chance: 20, driveMinutes: 30 }));
    expect(score({ chance: 65, driveMinutes: 105 })).toBeLessThan(score({ chance: 60, driveMinutes: 45 }));
  });

  it("makes long night drives disproportionately expensive", () => {
    expect(driveCost(150) - driveCost(120)).toBeGreaterThan(driveCost(60) - driveCost(30));
  });

  it("prefers verified-good roads over unknown or icy ones", () => {
    expect(score({ roadStatus: "unknown" })).toBeLessThan(score());
    expect(score({ roadStatus: "caution" })).toBeLessThan(score({ roadStatus: "unknown" }));
  });

  describe("scenery", () => {
    it("prefers an iconic setting when the chances are similar", () => {
      expect(score({ scenery: 1, chance: 58 })).toBeGreaterThan(score({ scenery: 0.4, chance: 61 }));
    });

    it("never beats a clearly better chance", () => {
      expect(score({ scenery: 1, chance: 50 })).toBeLessThan(score({ scenery: 0.4, chance: 60 }));
    });

    it("matters less when the sky gives little chance anyway", () => {
      const gapAtHighChance = score({ scenery: 1, chance: 80 }) - score({ scenery: 0.4, chance: 80 });
      const gapAtLowChance = score({ scenery: 1, chance: 10 }) - score({ scenery: 0.4, chance: 10 });
      expect(gapAtLowChance).toBeLessThan(gapAtHighChance);
    });

    it("never makes an unsafe road acceptable", () => {
      expect(computeRecommendationScore({ ...base, scenery: 1, chance: 96, roadStatus: "closed" }).recommended).toBe(false);
    });
  });

  describe("wind", () => {
    it("penalises strong gusts more and more", () => {
      expect(windPenalty(10)).toBe(0);
      expect(windPenalty(20)).toBeGreaterThan(2);
      expect(windPenalty(26)).toBeGreaterThan(14);
      expect(score({ maxGustKph: 95 })).toBeLessThan(score({ maxGustKph: 50 }));
    });

    it("rules a trip out in storm-force gusts", () => {
      const storm = computeRecommendationScore({ ...base, chance: 90, maxGustKph: BLOCKING_GUST_MS * 3.6 });
      expect(storm).toMatchObject({ recommended: false, blockedBy: "wind" });
      expect(computeRecommendationScore({ ...base, maxGustKph: BLOCKING_GUST_MS * 3.6 - 4 }).recommended).toBe(true);
    });
  });

  it("keeps ranking information on hopeless nights instead of clamping everything to zero", () => {
    expect(score({ chance: 4, driveMinutes: 120 })).toBeLessThan(score({ chance: 4, driveMinutes: 30 }));
    expect(score({ chance: 4, driveMinutes: 120 })).toBeLessThan(0);
  });
});
