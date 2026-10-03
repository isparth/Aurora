import { describe, expect, it } from "vitest";

import {
  angularSeparationDeg,
  artificialLuminance,
  moonLuminance,
  NATURAL_SKY_CD,
  naturalSkyLuminance,
  twilightLuminance,
  visualThresholdKr,
} from "./sky-brightness";

describe("twilightLuminance (Patat et al. 2006, V band, sea level)", () => {
  it("matches the published fit at the end of nautical twilight", () => {
    // m_V(ζ = 102°) = 11.84 + 1.518·7 − 0.057·49 = 19.67 mag/arcsec² at Paranal, minus the night sky, +30% at sea level.
    expect(twilightLuminance(-12)).toBeGreaterThan(1.5e-3);
    expect(twilightLuminance(-12)).toBeLessThan(1.8e-3);
  });

  it("fades monotonically and is gone in astronomical darkness", () => {
    const values = [-4, -6, -8, -10, -12, -14, -16].map(twilightLuminance);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
    expect(twilightLuminance(-18)).toBe(0);
    expect(twilightLuminance(-40)).toBe(0);
  });
});

describe("moonLuminance (Krisciunas & Schaefer 1991)", () => {
  const fullHigh = { moonAltitudeDeg: 40, illumination: 1, separationDeg: 50, viewZenithDeg: 0 };

  it("brightens the zenith of a full-moon night about twentyfold", () => {
    const ratio = moonLuminance(fullHigh) / NATURAL_SKY_CD;
    expect(ratio).toBeGreaterThan(15);
    expect(ratio).toBeLessThan(30);
  });

  it("is zero with the moon below the horizon", () => {
    expect(moonLuminance({ ...fullHigh, moonAltitudeDeg: -2 })).toBe(0);
  });

  it("falls steeply away from full moon and grows with the moon's altitude", () => {
    expect(moonLuminance({ ...fullHigh, illumination: 0.5 })).toBeLessThan(moonLuminance(fullHigh) * 0.2);
    expect(moonLuminance({ ...fullHigh, moonAltitudeDeg: 10, separationDeg: 80 })).toBeLessThan(moonLuminance(fullHigh));
  });

  it("is brightest close to the moon", () => {
    expect(moonLuminance({ ...fullHigh, separationDeg: 15 })).toBeGreaterThan(moonLuminance({ ...fullHigh, separationDeg: 90 }));
  });
});

describe("artificialLuminance", () => {
  it("turns the site's light-pollution score into town glow relative to the natural sky", () => {
    expect(artificialLuminance(1) / NATURAL_SKY_CD).toBeCloseTo(0.01, 4);
    expect(artificialLuminance(0.35) / NATURAL_SKY_CD).toBeCloseTo(3.98, 1);
    expect(artificialLuminance(0.6)).toBeGreaterThan(artificialLuminance(0.9));
  });
});

describe("naturalSkyLuminance", () => {
  it("is brighter towards the horizon (longer airglow path) than at the zenith", () => {
    expect(naturalSkyLuminance(90)).toBeCloseTo(NATURAL_SKY_CD, 8);
    expect(naturalSkyLuminance(20)).toBeGreaterThan(1.5 * NATURAL_SKY_CD);
  });
});

describe("visualThresholdKr (Crumey 2014 large-target threshold)", () => {
  it("is 1 kR — IBC I, about the Milky Way's brightness — in a natural dark sky", () => {
    expect(visualThresholdKr(NATURAL_SKY_CD)).toBeCloseTo(1, 6);
  });

  it("rises less than proportionally with sky brightness (de Vries–Rose regime)", () => {
    const tenfold = visualThresholdKr(10 * NATURAL_SKY_CD);
    expect(tenfold).toBeGreaterThan(4.6);
    expect(tenfold).toBeLessThan(5.5);
  });

  it("is continuous across the scotopic/photopic split", () => {
    expect(visualThresholdKr(0.3539)).toBeCloseTo(visualThresholdKr(0.3541), 0);
  });
});

describe("angularSeparationDeg", () => {
  it("measures the angle between two sky directions", () => {
    expect(angularSeparationDeg({ altitudeDeg: 90, azimuthDeg: 0 }, { altitudeDeg: 40, azimuthDeg: 180 })).toBeCloseTo(50, 6);
    expect(angularSeparationDeg({ altitudeDeg: 0, azimuthDeg: 0 }, { altitudeDeg: 0, azimuthDeg: 180 })).toBeCloseTo(180, 6);
  });
});
