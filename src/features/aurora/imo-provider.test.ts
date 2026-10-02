import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { activityForNight, parseImoAuroraXml } from "./imo-provider";

const fixture = readFileSync(new URL("./__fixtures__/imo-aurora.xml", import.meta.url), "utf8");

describe("parseImoAuroraXml", () => {
  it("parses activity and sun times from the real IMO service format", () => {
    const nights = parseImoAuroraXml(fixture);
    expect(nights.length).toBeGreaterThanOrEqual(3);
    expect(nights[0].eveningDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const n of nights) {
      expect(n.activity === null || (n.activity >= 0 && n.activity <= 9)).toBe(true);
    }
    expect(nights[0].sunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it("maps empty or out-of-range activity to null instead of guessing", () => {
    const xml = `<aurora>
      <night_data><evening_date>2026-01-01</evening_date><activity_forecast></activity_forecast></night_data>
      <night_data><evening_date>2026-01-02</evening_date><activity_forecast>12</activity_forecast></night_data>
      <night_data><evening_date>2026-01-03</evening_date><activity_forecast>5</activity_forecast></night_data>
    </aurora>`;
    expect(parseImoAuroraXml(xml).map((n) => n.activity)).toEqual([null, null, 5]);
  });

  it("handles a single night and skips malformed entries", () => {
    const xml = `<aurora><night_data><evening_date>bad</evening_date></night_data><night_data><evening_date>2026-02-01</evening_date><activity_forecast>3</activity_forecast></night_data></aurora>`;
    const nights = parseImoAuroraXml(xml);
    expect(nights).toHaveLength(1);
    expect(activityForNight({ source: "imo", fetchedAt: "", nights }, "2026-02-01")).toEqual({ activity: 3, fromDate: "2026-02-01" });
  });

  it("falls back to an adjacent night (e.g. after IMO rolls over at midnight) and says so", () => {
    const forecast = { source: "imo" as const, fetchedAt: "", nights: [{ eveningDate: "2026-10-03", activity: 3 }] };
    expect(activityForNight(forecast, "2026-10-02")).toEqual({ activity: 3, fromDate: "2026-10-03" });
    expect(activityForNight(forecast, "2026-10-09")).toEqual({ activity: null, fromDate: null });
  });

  it("returns no nights for unrelated XML", () => {
    expect(parseImoAuroraXml("<html><body>maintenance</body></html>")).toEqual([]);
  });
});
