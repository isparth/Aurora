import { describe, expect, it } from "vitest";

import type { CameraProvider, RoadConditionProvider, RoutingProvider, WeatherProvider } from "@/domain/providers";
import type { Confidence, Coordinates, HourlyWeather, RoadStatus, ViewingLocation } from "@/domain/types";

import { recommend, type EngineContext, type EngineProviders } from "./engine";

const HOUR = 3_600_000;
const REYKJAVIK = { lat: 64.1466, lon: -21.9426, label: "Reykjavík" };
/** 19:30 Iceland time; the night (sun below −6°) begins at 20:00. */
const NOW = Date.UTC(2026, 9, 2, 19, 30);

const place = (id: string, lat: number, lon: number): ViewingLocation => ({
  id,
  name: id,
  description: "",
  latitude: lat,
  longitude: lon,
  region: "Golden Circle",
  lightPollutionScore: 0.9,
  normalCarAccessible: true,
  winterAccessible: true,
  parkingAvailable: true,
  tags: [],
});

const A = place("brief-clearing", 64.2554, -21.128);
const B = place("steady", 63.9299, -21.9947);

/** Hourly weather from 18:00 for 16 hours, cloud cover chosen per hour (Iceland time = UTC). */
function weather(cloudAt: (hourOfDay: number) => number): HourlyWeather[] {
  const start = Date.UTC(2026, 9, 2, 18);
  return Array.from({ length: 16 }, (_, i) => ({
    time: start + i * HOUR,
    cloudTotal: cloudAt((18 + i) % 24),
    temperatureC: -2,
    precipitationMm: 0,
    visibilityKm: 30,
    windKph: 10,
  }));
}

const clearUntil21 = weather((h) => (h >= 19 && h <= 21 ? 0.05 : 0.95));
const steadyPartlyClear = weather(() => 0.3);
const clearAllNight = weather(() => 0.05);

const keyOf = (p: Coordinates) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
const byLocation = <T,>(map: Record<string, T>) => {
  const lookup = new Map(Object.entries(map).map(([id, v]) => {
    const l = [A, B].find((x) => x.id === id)!;
    return [keyOf({ lat: l.latitude, lon: l.longitude }), v] as const;
  }));
  return (p: Coordinates) => lookup.get(keyOf(p));
};

function context(opts: {
  weather: Record<string, HourlyWeather[] | Error>;
  drive: Record<string, number>;
  roads?: Record<string, RoadStatus>;
  overrides?: Partial<EngineProviders>;
}): EngineContext {
  const weatherFor = byLocation(opts.weather);
  const driveFor = byLocation(opts.drive);
  const roadFor = byLocation(opts.roads ?? {});

  const weatherProvider: WeatherProvider = {
    async getHourlyForecast(lat, lon) {
      const w = weatherFor({ lat, lon });
      if (!w || w instanceof Error) throw w ?? new Error("no data");
      return w;
    },
  };
  const routing: RoutingProvider = {
    name: "osrm",
    route: async (_o, d) => ({ durationMinutes: driveFor(d) ?? 30, distanceKm: 40, source: "osrm", estimated: false }),
  };
  const roads: RoadConditionProvider = {
    assess: async (d) => ({ status: roadFor(d) ?? "good", description: roadFor(d) === "closed" ? "Closed on Route 36" : undefined, segments: [], coverage: "route", source: "irca" }),
  };

  return {
    providers: {
      aurora: { getForecast: async () => ({ source: "imo", fetchedAt: new Date(NOW).toISOString(), nights: [{ eveningDate: "2026-10-02", activity: 4 }] }) },
      weather: weatherProvider,
      routing,
      roads,
      cameras: null,
      vision: null,
      ...opts.overrides,
    },
    locations: [A, B],
    demo: false,
  };
}

const run = (ctx: EngineContext) => recommend({ origin: REYKJAVIK, travelMode: "chase", now: NOW }, ctx);
const ids = (recs: { location: { id: string } }[]) => recs.map((r) => r.location.id);

describe("recommend — location × time", () => {
  it("scores every slot of the night and reports a contiguous best window", async () => {
    const res = await run(context({ weather: { [A.id]: clearUntil21, [B.id]: steadyPartlyClear }, drive: { [A.id]: 10, [B.id]: 20 } }));
    const top = res.recommendations[0];
    expect(top.hourly.length).toBeGreaterThanOrEqual(20);
    expect(top.bestWindow).not.toBeNull();
    expect(Date.parse(top.bestWindow!.end)).toBeGreaterThan(Date.parse(top.bestWindow!.start));
    expect(top.reasons.length).toBeGreaterThan(0);
  });
});

describe("recommend — travel time", () => {
  it("ranks a briefly clear spot first when you can get there in time", async () => {
    const res = await run(context({ weather: { [A.id]: clearUntil21, [B.id]: steadyPartlyClear }, drive: { [A.id]: 10, [B.id]: 20 } }));
    expect(ids(res.recommendations)[0]).toBe(A.id);
  });

  it("drops that spot when its clear spell ends before you could arrive", async () => {
    const res = await run(context({ weather: { [A.id]: clearUntil21, [B.id]: steadyPartlyClear }, drive: { [A.id]: 120, [B.id]: 20 } }));
    expect(ids(res.recommendations)[0]).toBe(B.id);
    const a = res.recommendations.find((r) => r.location.id === A.id);
    if (a) {
      expect(a.rank).toBeGreaterThan(1);
      expect(a.hourly.filter((h) => !h.reachable).length).toBeGreaterThan(0);
    }
  });

  it("schedules departure before the window by the drive time plus a buffer", async () => {
    const res = await run(context({ weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear }, drive: { [A.id]: 40, [B.id]: 20 } }));
    const a = res.recommendations.find((r) => r.location.id === A.id)!;
    const leave = Date.parse(a.recommendedDeparture!);
    const start = Date.parse(a.bestWindow!.start);
    expect(a.leaveNow || start - leave >= (40 + 10) * 60_000).toBe(true);
  });
});

describe("recommend — road safety", () => {
  it("never recommends a closed road, however good the sky, and promotes the next safe option", async () => {
    const res = await run(
      context({
        weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear },
        drive: { [A.id]: 30, [B.id]: 30 },
        roads: { [A.id]: "closed" },
      }),
    );
    expect(ids(res.recommendations)).toEqual([B.id]);
    const blocked = res.notRecommended.find((r) => r.location.id === A.id)!;
    expect(blocked.recommended).toBe(false);
    expect(blocked.notRecommendedReason).toMatch(/closed/);
    expect(blocked.viewingScore).toBeGreaterThan(res.recommendations[0].viewingScore);
  });

  it("treats difficult roads as a hard constraint too", async () => {
    const res = await run(
      context({ weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear }, drive: { [A.id]: 30, [B.id]: 30 }, roads: { [A.id]: "difficult" } }),
    );
    expect(ids(res.recommendations)).not.toContain(A.id);
  });
});

describe("recommend — missing data", () => {
  it("works without any camera provider", async () => {
    const res = await run(context({ weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear }, drive: { [A.id]: 30, [B.id]: 30 } }));
    expect(res.recommendations.length).toBe(2);
    expect(res.recommendations[0].camera).toBeUndefined();
    expect(res.recommendations[0].components.camera).toBeNull();
  });

  it("omits camera evidence when the camera service fails", async () => {
    const brokenCameras: CameraProvider = {
      getAllCameras: async () => {
        throw new Error("down");
      },
      getNearbyCameras: async () => {
        throw new Error("down");
      },
      getCameraImage: async () => null,
    };
    const res = await run(
      context({ weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear }, drive: { [A.id]: 30, [B.id]: 30 }, overrides: { cameras: brokenCameras } }),
    );
    expect(res.recommendations.length).toBe(2);
    expect(res.dataStatus.cameras.state).toBe("unavailable");
  });
});

describe("recommend — provider failures degrade gracefully", () => {
  const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

  it("keeps ranking when the aurora service is down, with lower confidence and a notice", async () => {
    const base = { weather: { [A.id]: steadyPartlyClear, [B.id]: steadyPartlyClear }, drive: { [A.id]: 30, [B.id]: 60 } };
    const healthy = await run(context(base));
    const res = await run(
      context({
        ...base,
        overrides: {
          aurora: {
            getForecast: async () => {
              throw new Error("IMO down");
            },
          },
        },
      }),
    );
    expect(res.recommendations.length).toBe(2);
    expect(res.aurora.available).toBe(false);
    expect(res.notices.join(" ")).toMatch(/Aurora activity temporarily unavailable/);
    expect(confidenceRank[res.recommendations[0].confidence]).toBeLessThanOrEqual(confidenceRank[healthy.recommendations[0].confidence]);
  });

  it("ranks the remaining locations when one weather forecast fails", async () => {
    const res = await run(context({ weather: { [A.id]: new Error("timeout"), [B.id]: steadyPartlyClear }, drive: { [A.id]: 30, [B.id]: 30 } }));
    expect(ids(res.recommendations)).toEqual([B.id]);
    expect(res.dataStatus.weather.state).toBe("degraded");
  });

  it("falls back to estimated drive times and unknown roads when routing and road services fail", async () => {
    const res = await run(
      context({
        weather: { [A.id]: clearAllNight, [B.id]: steadyPartlyClear },
        drive: {},
        overrides: {
          routing: {
            name: "osrm",
            route: async () => {
              throw new Error("routing down");
            },
          },
          roads: {
            assess: async () => {
              throw new Error("roads down");
            },
          },
        },
      }),
    );
    expect(res.recommendations.length).toBe(2);
    expect(res.recommendations.every((r) => r.travel.estimated)).toBe(true);
    expect(res.recommendations.every((r) => r.road.status === "unknown")).toBe(true);
    expect(res.notices.join(" ")).toMatch(/Road conditions unavailable/);
    expect(res.dataStatus.routing.state).toBe("unavailable");
  });

  it("reports an empty state instead of crashing when every forecast fails", async () => {
    const res = await run(context({ weather: { [A.id]: new Error("x"), [B.id]: new Error("y") }, drive: {} }));
    expect(res.recommendations).toEqual([]);
    expect(res.emptyReason).toBe("no-forecast");
  });

  it("never presents stale cached aurora data as live", async () => {
    const res = await run(
      context({
        weather: { [A.id]: steadyPartlyClear, [B.id]: steadyPartlyClear },
        drive: { [A.id]: 30, [B.id]: 30 },
        overrides: {
          aurora: {
            getForecast: async () => ({ source: "imo", fetchedAt: new Date(NOW - 3 * HOUR).toISOString(), nights: [{ eveningDate: "2026-10-02", activity: 4 }] }),
          },
        },
      }),
    );
    expect(res.dataStatus.aurora.state).toBe("degraded");
    expect(res.notices.join(" ")).toMatch(/couldn't be refreshed/);
  });

  it("explains an empty result as 'no reachable window' when the real drive only arrives after dawn", async () => {
    const preDawn = Date.UTC(2026, 9, 3, 5, 0);
    const res = await recommend(
      { origin: REYKJAVIK, travelMode: "chase", now: preDawn },
      context({ weather: { [A.id]: clearAllNight, [B.id]: clearAllNight }, drive: { [A.id]: 125, [B.id]: 125 } }),
    );
    expect(res.recommendations).toEqual([]);
    expect(res.emptyReason).toBe("no-window");
  });

  it("flags origins outside Iceland", async () => {
    const res = await recommend({ origin: { lat: 51.5, lon: -0.12, label: "London" }, travelMode: "standard", now: NOW }, context({ weather: {}, drive: {} }));
    expect(res.emptyReason).toBe("outside-coverage");
  });
});
