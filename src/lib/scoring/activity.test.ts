import { describe, expect, it } from "vitest";

import type { KpPoint } from "@/domain/types";

import { activityAt, FORECAST_SHRINK, KP_CLIMATOLOGY, KP_SCENARIOS, kpScenarios, type ActivityInputs } from "./activity";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 2, 21, 30);
const block = (hour: number, kp: number, kind: KpPoint["kind"] = "predicted"): KpPoint => ({ time: Date.UTC(2026, 9, 2, hour), kp, kind });
const none: ActivityInputs = { now: NOW, nowcast: null, kpForecast: [], imoKp: null };
const shrunk = (kp: number) => KP_CLIMATOLOGY.mean + FORECAST_SHRINK * (kp - KP_CLIMATOLOGY.mean);

describe("activityAt", () => {
  it("assumes a typical night when there is no activity data at all", () => {
    expect(activityAt(NOW, none)).toEqual({ mean: KP_CLIMATOLOGY.mean, sigma: KP_CLIMATOLOGY.sd, source: "typical" });
  });

  it("uses IMO's midnight forecast, pulled towards a typical night because Kp forecasts are only weakly skilful", () => {
    const a = activityAt(NOW + 2 * HOUR, { ...none, imoKp: 4 });
    expect(a.source).toBe("imo");
    expect(a.mean).toBeCloseTo(shrunk(4), 6);
    expect(a.sigma).toBeGreaterThan(1.2);
  });

  it("prefers NOAA's 3-hour forecast for the block containing the time", () => {
    const forecast = [block(21, 4.67), block(24, 2)];
    expect(activityAt(Date.UTC(2026, 9, 3, 1), { ...none, kpForecast: forecast, imoKp: 4 })).toMatchObject({ source: "forecast", mean: shrunk(2) });
  });

  it("takes observed blocks at face value", () => {
    expect(activityAt(Date.UTC(2026, 9, 2, 19), { ...none, kpForecast: [block(18, 3.33, "observed")] }).mean).toBeCloseTo(3.33, 6);
  });

  it("trusts the real-time estimate for the next hour or two, then hands over to the forecast", () => {
    const inputs: ActivityInputs = { ...none, kpForecast: [block(21, 4.67), block(24, 4.67), block(27, 4.67)], nowcast: { time: NOW - 10 * 60_000, kp: 0.33 } };
    const soon = activityAt(NOW, inputs);
    const later = activityAt(NOW + 6 * HOUR, inputs);
    expect(soon.source).toBe("nowcast");
    expect(soon.mean).toBeCloseTo(0.33, 1);
    expect(soon.sigma).toBeLessThan(later.sigma);
    expect(later.mean).toBeGreaterThan(shrunk(4.67) - 0.2);
  });

  it("falls back to IMO for the hours after NOAA's forecast runs out", () => {
    const inputs: ActivityInputs = { ...none, kpForecast: [block(21, 4.67)], imoKp: 3 };
    expect(activityAt(Date.UTC(2026, 9, 2, 23), inputs).source).toBe("forecast");
    const after = activityAt(Date.UTC(2026, 9, 3, 1), inputs);
    expect(after.source).toBe("imo");
    expect(Number.isFinite(after.mean) && Number.isFinite(after.sigma)).toBe(true);
  });

  it("ignores a real-time estimate that has gone stale", () => {
    const stale = activityAt(NOW, { ...none, imoKp: 3, nowcast: { time: NOW - 2 * HOUR, kp: 6 } });
    expect(stale.source).toBe("imo");
  });
});

describe("kpScenarios", () => {
  it("uses a rule that reproduces the normal distribution's variance and tails", () => {
    const moment = (n: number) => KP_SCENARIOS.reduce((s, { z, weight }) => s + weight * z ** n, 0);
    expect(moment(2)).toBeCloseTo(1, 6);
    expect(moment(4)).toBeCloseTo(3, 5);
  });

  it("spreads activity symmetrically with weights that sum to one, inside the Kp scale", () => {
    expect(KP_SCENARIOS.reduce((s, n) => s + n.weight, 0)).toBeCloseTo(1, 6);
    const ks = kpScenarios({ mean: 3, sigma: 1, source: "forecast" });
    expect(ks).toHaveLength(KP_SCENARIOS.length);
    expect(ks[0] + ks[ks.length - 1]).toBeCloseTo(6, 6);
    expect(Math.min(...kpScenarios({ mean: 0.3, sigma: 1.3, source: "forecast" }))).toBe(0);
    expect(Math.max(...kpScenarios({ mean: 8.5, sigma: 1.3, source: "forecast" }))).toBe(9);
  });
});
