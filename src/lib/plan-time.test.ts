import { describe, expect, it } from "vitest";

import type { RecommendationResponse } from "@/domain/types";

import { planTimes, verdict } from "./plan-time";

const at = (hhmm: string, day = 2) => Date.parse(`2026-10-0${day}T${hhmm}:00Z`);

const rec = {
  bestWindow: { start: "2026-10-02T21:30:00.000Z", end: "2026-10-03T01:30:00.000Z", peak: "2026-10-02T23:00:00.000Z" },
  recommendedDeparture: "2026-10-02T20:35:00.000Z",
  leaveNow: false,
  travel: { durationMinutes: 44, distanceKm: 48, estimated: false, source: "osrm" as const },
};

describe("planTimes", () => {
  it("counts down to departure and the window", () => {
    const t = planTimes(rec, at("19:40"));
    expect(t.leave).toEqual({ label: "Leave at", value: "20:35", sub: "in 55 min", urgent: false });
    expect(t.window).toMatchObject({ value: "21:30–01:30", sub: "starts in 1 h 50 min", live: false });
  });

  it("switches to 'leave now' once the departure time has passed, without waiting for a refresh", () => {
    const t = planTimes(rec, at("20:50"));
    expect(t.leave).toMatchObject({ value: "Now", sub: "to be there by 21:30", urgent: true });
  });

  it("describes a window that is already under way, and one that has passed", () => {
    expect(planTimes(rec, at("22:00")).window).toMatchObject({ value: "Now – 01:30", sub: "for another 3 h 30 min", live: true });
    expect(planTimes(rec, at("02:00", 3)).window).toMatchObject({ over: true, sub: "This window has passed" });
  });

  it("handles being at the spot already", () => {
    const here = { ...rec, travel: { ...rec.travel, durationMinutes: 0 } };
    expect(planTimes(here, at("22:00")).leave).toMatchObject({ value: "You're here", sub: "Look up now" });
  });
});

describe("verdict", () => {
  const response = (score: number, extra: Partial<RecommendationResponse> = {}) =>
    ({
      recommendations: [{ ...rec, viewingScore: score, location: { name: "Þingvellir" } }],
      notRecommended: [],
      ...extra,
    }) as unknown as RecommendationResponse;

  it("answers the question first, then gives the plan", () => {
    expect(verdict(response(89), at("19:40"))).toEqual({
      headline: "Great conditions tonight",
      summary: "Clearest at Þingvellir from 21:30 to 01:30. Leave at 20:35 (in 55 min).",
    });
  });

  it("is honest when it's cloudy everywhere", () => {
    expect(verdict(response(30), at("19:40")).summary).toMatch(/^Mostly cloudy nearby\. Best bet: Þingvellir/);
  });

  it("explains empty results and blocked roads", () => {
    const empty = { recommendations: [], notRecommended: [], emptyReason: "no-darkness" } as unknown as RecommendationResponse;
    expect(verdict(empty, at("19:40")).headline).toBe("Too bright for aurora tonight");
    const blocked = { recommendations: [], notRecommended: [{}] } as unknown as RecommendationResponse;
    expect(verdict(blocked, at("19:40")).headline).toBe("Unsafe roads to the clear spots");
  });
});
