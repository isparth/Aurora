import { describe, expect, it } from "vitest";

import { formatChance, scoreLabel, skyDarknessLabel } from "./labels";

describe("formatChance", () => {
  it("rounds to the nearest 5% and never claims certainty either way", () => {
    expect(formatChance(0)).toBe("<5%");
    expect(formatChance(4)).toBe("<5%");
    expect(formatChance(63)).toBe("65%");
    expect(formatChance(72)).toBe("70%");
    expect(formatChance(97)).toBe(">95%");
  });
});

describe("scoreLabel", () => {
  it("labels chances: 70%+ excellent, 45%+ good, 20%+ fair", () => {
    expect([75, 50, 25, 10].map(scoreLabel)).toEqual(["Excellent", "Good", "Fair", "Poor"]);
  });
});

describe("skyDarknessLabel", () => {
  it("explains what a bright sky means for faint aurora", () => {
    expect(skyDarknessLabel({ brightSky: null, thresholdKr: 1.1 }).label).toBe("Dark");
    expect(skyDarknessLabel({ brightSky: "moon", thresholdKr: 7 }).detail).toMatch(/moderate or strong/);
    expect(skyDarknessLabel({ brightSky: "twilight", thresholdKr: 40 }).label).toBe("Too bright");
  });
});
