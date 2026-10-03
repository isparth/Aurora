import { describe, expect, it } from "vitest";

import { CLIMATOLOGICAL_VIEW, opaqueCloud, skyViewProbability } from "./sky-view";

const view = (clouds: Parameters<typeof opaqueCloud>[0], extra: Partial<Parameters<typeof skyViewProbability>[0]> = {}) =>
  skyViewProbability({ clouds, elevationDeg: 90, leadHours: 0, ...extra });

describe("opaqueCloud", () => {
  it("combines low and mid cloud as independent layers and leaves cirrus out", () => {
    expect(opaqueCloud({ total: 0.7, low: 0.5, middle: 0.5, high: 0 })).toBeCloseTo(1 - 0.5 * 0.55, 6);
    expect(opaqueCloud({ total: 1, low: 0, middle: 0, high: 1 })).toBe(0);
  });

  it("does not let inconsistent layer data make an overcast sky look clear", () => {
    expect(opaqueCloud({ total: 1, low: 0, middle: 0, high: 0 })).toBe(1);
  });

  it("falls back to total cloud when layers are missing", () => {
    expect(opaqueCloud({ total: 0.42 })).toBe(0.42);
  });
});

describe("skyViewProbability", () => {
  it("is near certain under a clear sky and near zero under solid low cloud", () => {
    expect(view({ total: 0, low: 0, middle: 0, high: 0 })).toBeGreaterThan(0.95);
    expect(view({ total: 1, low: 1, middle: 0, high: 0 })).toBeLessThan(0.05);
  });

  it("leaves gaps in broken cloud, more usefully overhead than low on the horizon", () => {
    const overhead = view({ total: 0.5, low: 0.5, middle: 0, high: 0 });
    const lowInTheNorth = view({ total: 0.5, low: 0.5, middle: 0, high: 0 }, { elevationDeg: 8 });
    expect(overhead).toBeGreaterThan(0.65);
    expect(overhead).toBeLessThan(0.8);
    expect(lowInTheNorth).toBeLessThan(overhead - 0.15);
  });

  it("does not block the view for thin high cloud alone (it only dims the aurora)", () => {
    expect(view({ total: 1, low: 0, middle: 0, high: 1 })).toBeGreaterThan(0.9);
  });

  it("is cut by fog and by falling rain or snow", () => {
    const clear = { total: 0.1, low: 0.1, middle: 0, high: 0 };
    expect(view(clear, { visibilityKm: 0.3 })).toBeLessThan(0.2);
    expect(view(clear, { precipitationMm: 1 })).toBeLessThan(view(clear) * 0.6);
  });

  it("trusts a forecast less the further ahead it is, drifting towards Iceland's usual odds", () => {
    const overcast = { total: 1, low: 1, middle: 0, high: 0 };
    const clear = { total: 0, low: 0, middle: 0, high: 0 };
    expect(view(overcast, { leadHours: 12 })).toBeGreaterThan(view(overcast));
    expect(view(clear, { leadHours: 12 })).toBeLessThan(view(clear));
    expect(view(overcast, { leadHours: 48 })).toBeLessThan(CLIMATOLOGICAL_VIEW);
  });
});
