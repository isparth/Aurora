import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normaliseOpenMeteoResponse } from "./open-meteo-provider";

const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/open-meteo-two-points.json", import.meta.url), "utf8"));

describe("normaliseOpenMeteoResponse", () => {
  it("normalises a multi-location response into fractions, km and epoch ms", () => {
    const [first, second] = normaliseOpenMeteoResponse(fixture);
    expect(first.length).toBe(24);
    expect(second.length).toBe(24);
    const hour = first[0];
    expect(hour.time).toBe(fixture[0].hourly.time[0] * 1000);
    expect(hour.cloudTotal).toBeGreaterThanOrEqual(0);
    expect(hour.cloudTotal).toBeLessThanOrEqual(1);
    if (hour.visibilityKm !== undefined) expect(hour.visibilityKm).toBeCloseTo(fixture[0].hourly.visibility[0] / 1000);
  });

  it("accepts the single-object shape returned for one coordinate", () => {
    expect(normaliseOpenMeteoResponse(fixture[0])).toHaveLength(1);
  });

  it("skips hours without cloud data and keeps missing optional fields undefined", () => {
    const raw = { hourly: { time: [0, 3600], cloud_cover: [null, 50], precipitation: [0, null] } };
    const [hours] = normaliseOpenMeteoResponse(raw);
    expect(hours).toEqual([{ time: 3600_000, cloudTotal: 0.5, cloudLow: undefined, cloudMid: undefined, cloudHigh: undefined, temperatureC: undefined, precipitationMm: undefined, visibilityKm: undefined, windKph: undefined, gustKph: undefined }]);
  });

  it("rejects payloads that are not Open-Meteo forecasts", () => {
    expect(() => normaliseOpenMeteoResponse({ error: true, reason: "rate limited" })).toThrow();
  });
});
