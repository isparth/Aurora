import { describe, expect, it } from "vitest";

import { clothingAdvice, feelsLikeC } from "./weather-feel";

describe("feelsLikeC", () => {
  it("applies wind chill in cold, windy weather", () => {
    expect(feelsLikeC(-2, 30)).toBeCloseTo(-9.1, 1);
    expect(feelsLikeC(-2, 30)).toBeLessThan(feelsLikeC(-2, 10));
  });

  it("is just the air temperature when it's calm or mild", () => {
    expect(feelsLikeC(-5, 2)).toBe(-5);
    expect(feelsLikeC(12, 40)).toBe(12);
  });
});

describe("clothingAdvice", () => {
  it("gets more serious as it gets colder", () => {
    expect(clothingAdvice(-14)).toMatch(/thermal layers/);
    expect(clothingAdvice(-3)).toMatch(/hat and gloves/);
    expect(clothingAdvice(5)).toMatch(/windproof/);
  });
});
