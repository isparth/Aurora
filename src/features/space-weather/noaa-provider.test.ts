import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseKpForecast, parseKpNowcast } from "./noaa-provider";

const forecastFixture = JSON.parse(readFileSync(new URL("./__fixtures__/kp-forecast.json", import.meta.url), "utf8"));
const oneMinuteFixture = JSON.parse(readFileSync(new URL("./__fixtures__/kp-1m.json", import.meta.url), "utf8"));

describe("parseKpForecast", () => {
  it("parses NOAA's 3-hour Kp product (object format since March 2026) as UTC blocks", () => {
    const blocks = parseKpForecast(forecastFixture);
    expect(blocks.length).toBe(forecastFixture.length);
    expect(blocks[0]).toEqual({ time: Date.parse(`${forecastFixture[0].time_tag}Z`), kp: forecastFixture[0].kp, kind: "observed" });
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(["observed", "estimated", "predicted"]));
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].time - blocks[i - 1].time).toBe(3 * 3_600_000);
  });

  it("accepts quoted numbers and skips malformed entries instead of failing the whole forecast", () => {
    const blocks = parseKpForecast([
      { time_tag: "2026-10-03T00:00:00", kp: "3.67", observed: "predicted", noaa_scale: null },
      { time_tag: "2026-10-03T03:00:00", kp: 12, observed: "predicted" },
      { time_tag: "not a date", kp: 2, observed: "predicted" },
      { time_tag: "2026-10-03T06:00:00", kp: null, observed: "predicted" },
    ]);
    expect(blocks).toEqual([{ time: Date.UTC(2026, 9, 3, 0), kp: 3.67, kind: "predicted" }]);
  });

  it("rejects a payload that is not a list", () => {
    expect(() => parseKpForecast({ error: "maintenance" })).toThrow();
  });
});

describe("parseKpNowcast", () => {
  it("averages the last half hour of the 1-minute estimated Kp", () => {
    const nowcast = parseKpNowcast(oneMinuteFixture)!;
    const latest = oneMinuteFixture[oneMinuteFixture.length - 1];
    expect(nowcast.time).toBe(Date.parse(`${latest.time_tag}Z`));
    expect(nowcast.kp).toBeGreaterThanOrEqual(0);
    expect(nowcast.kp).toBeLessThanOrEqual(9);
  });

  it("ignores values older than 30 minutes before the latest one", () => {
    const nowcast = parseKpNowcast([
      { time_tag: "2026-10-02T21:00:00", estimated_kp: 7 },
      { time_tag: "2026-10-02T21:40:00", estimated_kp: 1 },
      { time_tag: "2026-10-02T21:50:00", estimated_kp: 2 },
    ]);
    expect(nowcast).toEqual({ time: Date.UTC(2026, 9, 2, 21, 50), kp: 1.5 });
  });

  it("returns null when there is nothing usable", () => {
    expect(parseKpNowcast([])).toBeNull();
    expect(parseKpNowcast([{ time_tag: "2026-10-02T21:50:00", estimated_kp: -1 }])).toBeNull();
  });
});
