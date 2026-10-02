import { describe, expect, it } from "vitest";

import { computeDeparture, earliestViewingTime, findBestWindow, isReachable, SLOT_MS, type ScoredSlot } from "./windows";

const T0 = Date.UTC(2026, 9, 2, 20, 0);
const slots = (scores: number[], reachableFrom = 0): ScoredSlot[] =>
  scores.map((score, i) => ({ time: T0 + i * SLOT_MS, score, reachable: i >= reachableFrom }));

describe("findBestWindow", () => {
  it("finds the contiguous period around the peak rather than a single timestamp", () => {
    const w = findBestWindow(slots([52, 68, 80, 90, 94, 91, 78, 62]));
    expect(w).toMatchObject({ startIndex: 3, endIndex: 5, peakIndex: 4, peakScore: 94 });
  });

  it("prefers a long steady window over a brief spike", () => {
    const w = findBestWindow(slots([95, 40, 40, 88, 89, 90, 88, 87]));
    expect(w?.startIndex).toBe(3);
    expect(w?.endIndex).toBe(7);
  });

  it("only uses slots the user can reach", () => {
    const w = findBestWindow(slots([95, 96, 60, 70, 72, 65], 2));
    expect(w?.startIndex).toBe(3);
    expect(w?.peakScore).toBe(72);
  });

  it("returns null when nothing is reachable or everything scores zero", () => {
    expect(findBestWindow(slots([80, 90], 5))).toBeNull();
    expect(findBestWindow(slots([0, 0, 0]))).toBeNull();
  });
});

describe("reachability", () => {
  it("counts a slot as reachable only if you arrive by its midpoint", () => {
    const arrive = earliestViewingTime(T0, 40);
    expect(isReachable(T0, arrive)).toBe(false);
    expect(isReachable(T0 + SLOT_MS, arrive)).toBe(true);
  });
});

describe("computeDeparture", () => {
  it("subtracts drive time and a buffer, rounded down to five minutes", () => {
    const windowStart = Date.UTC(2026, 9, 2, 22, 40);
    const { departure, leaveNow, bufferMinutes } = computeDeparture({ windowStart, now: T0, driveMinutes: 38 });
    expect(bufferMinutes).toBe(10);
    expect(new Date(departure).toISOString()).toBe("2026-10-02T21:50:00.000Z");
    expect(leaveNow).toBe(false);
  });

  it("says leave now when the window is too close", () => {
    const result = computeDeparture({ windowStart: T0 + 30 * 60_000, now: T0, driveMinutes: 40 });
    expect(result.leaveNow).toBe(true);
    expect(result.departure).toBe(T0);
  });
});
