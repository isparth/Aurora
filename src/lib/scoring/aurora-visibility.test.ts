import { describe, expect, it } from "vitest";

import { auroraGeometry, auroraVisibility, limitingFactor, magneticLocalTime, type SkyConditions } from "./aurora-visibility";

const DARK: SkyConditions = { sunAltitudeDeg: -30, moon: { altitudeDeg: -20, azimuthDeg: 0, illumination: 0 }, lightPollutionScore: 1, highCloud: 0 };
const FULL_MOON: SkyConditions = { ...DARK, moon: { altitudeDeg: 35, azimuthDeg: 180, illumination: 1 } };

const chance = (kp: number, cgmLatitude: number, sky: SkyConditions = DARK, mlt = 23.5) => auroraVisibility({ kp, mlt, cgmLatitude, sky }).probability;

describe("auroraVisibility — clear-sky chance that aurora bright enough to see is in view", () => {
  it("is near certain when an active oval is overhead in a dark sky", () => {
    expect(chance(5, 64.2)).toBeGreaterThan(0.9);
  });

  it("gives the north coast a real edge at low activity, but not when the oval is overhead everywhere", () => {
    const [south, capital, north] = [63.0, 64.2, 65.5].map((lat) => chance(2, lat));
    expect(north).toBeGreaterThan(capital);
    expect(capital).toBeGreaterThan(south);
    expect(north - south).toBeGreaterThan(0.5);
    expect(chance(6, 65.5) - chance(6, 63.0)).toBeLessThan(0.1);
  });

  it("peaks around magnetic midnight rather than early in the evening", () => {
    expect(chance(2, 64.2, DARK, 0.5)).toBeGreaterThan(chance(2, 64.2, DARK, 19.5) + 0.3);
  });

  it("lets a bright moon hide faint aurora far more than strong aurora", () => {
    const keepsModerate = chance(3, 64.2, FULL_MOON) / chance(3, 64.2);
    const keepsStrong = chance(6, 64.2, FULL_MOON) / chance(6, 64.2);
    expect(keepsModerate).toBeLessThan(0.6);
    expect(keepsStrong).toBeGreaterThan(keepsModerate + 0.15);
  });

  it("loses moderate aurora in town glow but still shows a strong display", () => {
    const town = { ...DARK, lightPollutionScore: 0.35 };
    expect(chance(3, 64.2, town)).toBeLessThan(chance(3, 64.2) - 0.15);
    expect(chance(6, 64.2, town)).toBeGreaterThan(0.85);
  });

  it("needs a very strong display to show through nautical twilight", () => {
    const twilight = { ...DARK, sunAltitudeDeg: -8 };
    expect(chance(2, 65.5, twilight)).toBeLessThan(0.02);
    expect(chance(7, 65.5, twilight)).toBeGreaterThan(0.1);
    expect(chance(7, 65.5, { ...DARK, sunAltitudeDeg: -13 })).toBeGreaterThan(0.85);
  });

  it("treats thin high cloud as a veil that hides faint aurora, not strong aurora", () => {
    const cirrus = { ...DARK, highCloud: 1 };
    expect(chance(2, 65.5, cirrus) / chance(2, 65.5)).toBeLessThan(chance(6, 65.5, cirrus) / chance(6, 65.5));
    expect(chance(6, 65.5, cirrus)).toBeGreaterThan(0.85);
  });

  it("says what brightens the sky", () => {
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: DARK }).brightSky).toBeNull();
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: FULL_MOON }).brightSky).toBe("moon");
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: { ...DARK, sunAltitudeDeg: -11 } }).brightSky).toBe("twilight");
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: { ...DARK, lightPollutionScore: 0.35 } }).brightSky).toBe("lights");
  });

  it("reports a threshold of about 1 kR in a dark sky and several kR under a full moon", () => {
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: DARK }).thresholdKr).toBeCloseTo(1, 0);
    expect(auroraVisibility({ kp: 3, mlt: 23.5, cgmLatitude: 64.2, sky: FULL_MOON }).thresholdKr).toBeGreaterThan(4);
  });
});

describe("auroraVisibility — monotonicity", () => {
  const SKIES: SkyConditions[] = [
    DARK,
    FULL_MOON,
    { ...DARK, moon: { altitudeDeg: 15, azimuthDeg: 20, illumination: 0.6 } },
    { ...DARK, sunAltitudeDeg: -11, lightPollutionScore: 0.4, highCloud: 0.5 },
  ];
  const CASES = SKIES.flatMap((sky) => [63, 64.2, 65.5].flatMap((cgmLatitude) => [20, 22, 23.5, 1, 3].map((mlt) => ({ sky, cgmLatitude, mlt }))));
  const p = (c: (typeof CASES)[number], kp: number, sky = c.sky) => auroraVisibility({ kp, mlt: c.mlt, cgmLatitude: c.cgmLatitude, sky }).probability;

  it("never falls as activity rises", () => {
    for (const c of CASES) for (let kp = 0; kp < 9; kp += 0.25) expect(p(c, kp + 0.25)).toBeGreaterThanOrEqual(p(c, kp) - 1e-9);
  });

  it("never rises as the sky gets brighter (sun higher, brighter moon, more town glow, more cirrus)", () => {
    for (const c of CASES) {
      for (const kp of [1, 2.5, 4, 6]) {
        const base = p(c, kp);
        expect(p(c, kp, { ...c.sky, sunAltitudeDeg: c.sky.sunAltitudeDeg + 3 })).toBeLessThanOrEqual(base + 1e-9);
        expect(p(c, kp, { ...c.sky, moon: { ...c.sky.moon, illumination: Math.min(1, c.sky.moon.illumination + 0.3) } })).toBeLessThanOrEqual(base + 1e-9);
        expect(p(c, kp, { ...c.sky, lightPollutionScore: c.sky.lightPollutionScore - 0.2 })).toBeLessThanOrEqual(base + 1e-9);
        expect(p(c, kp, { ...c.sky, highCloud: Math.min(1, c.sky.highCloud + 0.3) })).toBeLessThanOrEqual(base + 1e-9);
      }
    }
  });
});

describe("auroraGeometry", () => {
  it("puts the aurora overhead inside the oval and lower in the north the further away the oval is", () => {
    expect(auroraGeometry(4, 0, 64.2)).toMatchObject({ position: "overhead", ovalDistanceDeg: 0, elevationDeg: 90 });
    const near = auroraGeometry(2, 0, 64.2);
    const far = auroraGeometry(0, 0, 64.2);
    expect(near.position).toBe("north");
    expect(far.ovalDistanceDeg).toBeGreaterThan(near.ovalDistanceDeg);
    expect(far.elevationDeg).toBeLessThan(near.elevationDeg);
  });

  it("does not move the oval beyond the model's validated range", () => {
    expect(auroraGeometry(9, 0, 60)).toEqual(auroraGeometry(7, 0, 60));
  });
});

describe("limitingFactor", () => {
  const overhead = { position: "overhead" as const, distanceDeg: 0, elevationDeg: 90 };
  const farNorth = { position: "north" as const, distanceDeg: 3.5, elevationDeg: 8 };

  it("blames the clouds when the sky view is the weaker gate", () => {
    expect(limitingFactor({ skyView: 20, aurora: 70, thresholdKr: 1, oval: overhead })).toBe("clouds");
  });

  it("blames a bright sky when the oval is close but the moon or twilight raises the bar", () => {
    expect(limitingFactor({ skyView: 90, aurora: 30, thresholdKr: 7, oval: overhead })).toBe("bright-sky");
  });

  it("blames low activity when the oval is far away, even under some moonlight", () => {
    expect(limitingFactor({ skyView: 90, aurora: 2, thresholdKr: 4, oval: farNorth })).toBe("activity");
    expect(limitingFactor({ skyView: 90, aurora: 20, thresholdKr: 1.1, oval: { ...farNorth, distanceDeg: 1 } })).toBe("activity");
  });
});

describe("magneticLocalTime", () => {
  it("counts hours from magnetic midnight, wrapping at 24", () => {
    expect(magneticLocalTime(0.5, 0.5)).toBe(0);
    expect(magneticLocalTime(23.5, 0.5)).toBe(23);
    expect(magneticLocalTime(0.25, 0.5)).toBeCloseTo(23.75, 10);
  });
});
