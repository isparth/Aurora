import { describe, expect, it } from "vitest";

import {
  auroraActivityScore,
  auroraTimeFactor,
  computeViewingScore,
  effectiveCloudCover,
  VIEWING_WEIGHTS,
  weatherQuality,
  type ViewingInputs,
} from "./viewing-score";

const goodNight: ViewingInputs = {
  cloudCover: 0.1,
  auroraActivity: 4,
  darkness: 1,
  lightPollution: 0.9,
  weatherQuality: 0.9,
};

describe("computeViewingScore", () => {
  it("increases as cloud cover decreases", () => {
    const scores = [1, 0.8, 0.6, 0.4, 0.2, 0].map((cloudCover) => computeViewingScore({ ...goodNight, cloudCover }).overall);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it("increases with greater darkness", () => {
    const scores = [0.1, 0.3, 0.5, 0.7, 1].map((darkness) => computeViewingScore({ ...goodNight, darkness }).overall);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it("increases with higher aurora activity", () => {
    const scores = [0, 1, 2, 3, 4, 5, 6].map((auroraActivity) => computeViewingScore({ ...goodNight, auroraActivity }).overall);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it("lets cloud cover dominate: strong activity under overcast skies is still poor", () => {
    const overcast = computeViewingScore({ ...goodNight, cloudCover: 1, auroraActivity: 8 });
    expect(overcast.overall).toBeLessThan(15);
  });

  it("is zero in daylight regardless of other conditions", () => {
    expect(computeViewingScore({ ...goodNight, darkness: 0 }).overall).toBe(0);
  });

  it("rates the spec's example night (8% cloud, 4/9, dark, remote) as excellent", () => {
    const score = computeViewingScore({ cloudCover: 0.08, auroraActivity: 4, darkness: 1, lightPollution: 0.95, weatherQuality: 0.88 });
    expect(score.overall).toBeGreaterThanOrEqual(85);
    expect(score.overall).toBeLessThanOrEqual(95);
  });

  it("returns both the overall score and every component", () => {
    const score = computeViewingScore({ ...goodNight, cameraConfidence: 0.8 });
    expect(score.components).toEqual({ clouds: 90, aurora: 76, darkness: 100, lightPollution: 90, weather: 90, camera: 80 });
  });

  it("does not break or penalise a location without a camera", () => {
    const noCamera = computeViewingScore(goodNight);
    expect(noCamera.components.camera).toBeNull();
    expect(Number.isFinite(noCamera.overall)).toBe(true);
    const neutralCamera = computeViewingScore({ ...goodNight, cameraConfidence: 0.86 });
    expect(Math.abs(neutralCamera.overall - noCamera.overall)).toBeLessThanOrEqual(1);
  });

  it("treats a camera that sees aurora as strong positive evidence", () => {
    const quiet = { ...goodNight, auroraActivity: 1 };
    expect(computeViewingScore({ ...quiet, cameraSeesAurora: true }).overall).toBeGreaterThan(computeViewingScore(quiet).overall + 10);
  });

  it("does not punish a camera that fails to see aurora", () => {
    expect(computeViewingScore({ ...goodNight, cameraSeesAurora: false }).overall).toBe(computeViewingScore(goodNight).overall);
  });

  it("keeps ranking on sky conditions when aurora data is unavailable", () => {
    const unknown = computeViewingScore({ ...goodNight, auroraActivity: null });
    expect(unknown.components.aurora).toBeNull();
    expect(computeViewingScore({ ...goodNight, auroraActivity: null, cloudCover: 0.6 }).overall).toBeLessThan(unknown.overall);
  });

  it("keeps the weights explicit and summing to one", () => {
    const total = Object.values(VIEWING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(VIEWING_WEIGHTS.clouds).toBeGreaterThan(VIEWING_WEIGHTS.aurora);
  });
});

describe("effectiveCloudCover", () => {
  it("treats thin high cloud as less obstructive than low cloud", () => {
    const cirrus = effectiveCloudCover({ total: 1, low: 0, middle: 0, high: 1 });
    const stratus = effectiveCloudCover({ total: 1, low: 1, middle: 0, high: 0 });
    expect(cirrus).toBeLessThan(0.6);
    expect(stratus).toBe(1);
  });

  it("falls back to total cloud cover when layers are missing", () => {
    expect(effectiveCloudCover({ total: 0.42 })).toBe(0.42);
  });

  it("never reports a sky clearer than half its total cloud cover", () => {
    expect(effectiveCloudCover({ total: 0.8, low: 0, middle: 0, high: 0 })).toBe(0.4);
  });
});

describe("auroraActivityScore", () => {
  it("is monotonic over the IMO 0–9 scale", () => {
    for (let a = 1; a <= 9; a++) expect(auroraActivityScore(a)).toBeGreaterThan(auroraActivityScore(a - 1));
  });
});

describe("auroraTimeFactor", () => {
  it("peaks near magnetic midnight and stays gentle", () => {
    expect(auroraTimeFactor(23.5)).toBeCloseTo(1, 5);
    expect(auroraTimeFactor(19)).toBeLessThan(auroraTimeFactor(22));
    expect(auroraTimeFactor(12)).toBeGreaterThanOrEqual(0.85);
    expect(auroraTimeFactor(0.5)).toBeGreaterThan(auroraTimeFactor(3));
  });
});

describe("weatherQuality", () => {
  it("drops with rain, fog and strong wind", () => {
    const calm = weatherQuality({ precipitationMm: 0, visibilityKm: 30, windKph: 10 });
    expect(calm).toBe(1);
    expect(weatherQuality({ precipitationMm: 1, visibilityKm: 30, windKph: 10 })).toBeLessThan(0.5);
    expect(weatherQuality({ precipitationMm: 0, visibilityKm: 0.5, windKph: 10 })).toBeLessThan(0.1);
    expect(weatherQuality({ precipitationMm: 0, visibilityKm: 30, windKph: 60 })).toBeLessThan(0.6);
  });
});
