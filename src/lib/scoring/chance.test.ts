import { describe, expect, it } from "vitest";

import { findBestWindow, MAX_WINDOW_SLOTS, SESSION_CORRELATION, sessionChance, type ChanceSlot } from "./chance";
import { SLOT_MS } from "./windows";

const T0 = Date.UTC(2026, 9, 2, 20, 0);
const ONE = [1];
const slots = (chances: number[], reachableFrom = 0): ChanceSlot[] =>
  chances.map((chance, i) => ({ time: T0 + i * SLOT_MS, chance, scenarios: [chance], reachable: i >= reachableFrom }));

describe("sessionChance", () => {
  it("equals the single half hour's chance for a one-slot window", () => {
    expect(sessionChance(slots([0.4]), ONE)).toBeCloseTo(0.4, 10);
  });

  it("grows with every extra half hour, but far less than if each were an independent draw", () => {
    const one = sessionChance(slots([0.5]), ONE);
    const two = sessionChance(slots([0.5, 0.5]), ONE);
    const four = sessionChance(slots([0.5, 0.5, 0.5, 0.5]), ONE);
    expect(two).toBeCloseTo(0.5 + 0.5 * (1 - 0.5 ** SESSION_CORRELATION), 10);
    expect(four).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(one);
    expect(four).toBeLessThan(1 - 0.5 ** 4);
  });

  it("averages over activity scenarios, so a night that may stay quiet stays uncertain", () => {
    const night = [0, 1, 2].map(() => ({ scenarios: [0, 0.9] }));
    expect(sessionChance(night, [0.5, 0.5])).toBeLessThan(0.5);
  });
});

describe("findBestWindow", () => {
  it("finds the contiguous period around the night's best half hour", () => {
    expect(findBestWindow(slots([0.1, 0.3, 0.5, 0.6, 0.55, 0.3, 0.1]), ONE)).toMatchObject({ startIndex: 2, endIndex: 4, peakIndex: 3, peakChance: 0.6 });
  });

  it("prefers a long, steady chance to a brief spike when it gives the better chance overall", () => {
    const w = findBestWindow(slots([0.62, 0.1, 0.1, 0.55, 0.56, 0.57, 0.55, 0.54]), ONE)!;
    expect(w.startIndex).toBe(3);
    expect(w.endIndex).toBe(7);
    expect(w.chance).toBeGreaterThan(0.62);
  });

  it("only uses half hours you can reach", () => {
    expect(findBestWindow(slots([0.8, 0.7, 0.3, 0.35, 0.1], 2), ONE)).toMatchObject({ startIndex: 2, endIndex: 3, peakIndex: 3 });
  });

  it("never bridges a gap in the data", () => {
    const withGap = slots([0.5, 0.5, 0.5]).map((s, i) => (i === 2 ? { ...s, time: s.time + SLOT_MS } : s));
    expect(findBestWindow(withGap, ONE)?.endIndex).toBe(1);
  });

  it("keeps the window to a few hours", () => {
    const w = findBestWindow(slots(Array.from({ length: 20 }, () => 0.5)), ONE)!;
    expect(w.endIndex - w.startIndex + 1).toBe(MAX_WINDOW_SLOTS);
  });

  it("offers no window when nothing is reachable or there is no real chance", () => {
    expect(findBestWindow(slots([0.8, 0.9], 5), ONE)).toBeNull();
    expect(findBestWindow(slots([0.01, 0.02, 0.01]), ONE)).toBeNull();
  });
});
