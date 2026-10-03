import { describe, expect, it } from "vitest";

import { computeDeparture, earliestViewingTime, isReachable, SLOT_MS } from "./windows";

const T0 = Date.UTC(2026, 9, 2, 20, 0);

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
