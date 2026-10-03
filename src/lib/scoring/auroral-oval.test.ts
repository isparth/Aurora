import { describe, expect, it } from "vitest";

import { kpToAl, OVAL_MAX_KP, ovalBoundaries } from "./auroral-oval";

describe("kpToAl (Starkov 1994b)", () => {
  it("matches the published polynomial", () => {
    expect(kpToAl(0)).toBeCloseTo(18, 6);
    expect(kpToAl(3)).toBeCloseTo(18 - 36.9 + 244.8 - 54, 6);
  });
});

describe("ovalBoundaries (Starkov 1994a, Sigernes et al. 2011 coefficients)", () => {
  it("reproduces a hand calculation of the equatorward edge at magnetic midnight, Kp 3", () => {
    // AL = 171.9 nT → A01 = 21.35°, A11 = 4.89°, α11 = −0.87 h, small higher harmonics → colatitude 26.2°.
    expect(ovalBoundaries(3, 0).equatorward).toBeCloseTo(63.8, 1);
  });

  it("moves the oval towards the equator as activity rises", () => {
    const edges = [0, 1, 2, 3, 4, 5, 6].map((kp) => ovalBoundaries(kp, 23).equatorward);
    for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeLessThan(edges[i - 1]);
    // Iceland (≈63–66° CGM) sits under the oval near midnight from about Kp 2–3.
    expect(edges[2]).toBeGreaterThan(65);
    expect(edges[3]).toBeLessThan(64.5);
  });

  it("never retreats poleward as activity rises, at any magnetic local time", () => {
    for (let mlt = 0; mlt < 24; mlt += 0.5) {
      for (let kp = 0; kp < 7; kp += 0.1) {
        expect(ovalBoundaries(kp + 0.1, mlt).equatorward, `mlt ${mlt} kp ${kp.toFixed(1)}`).toBeLessThanOrEqual(ovalBoundaries(kp, mlt).equatorward + 1e-9);
      }
    }
  });

  it("keeps the evening oval further poleward than the midnight oval", () => {
    expect(ovalBoundaries(2, 19).equatorward).toBeGreaterThan(ovalBoundaries(2, 0).equatorward + 3);
  });

  it("always returns a poleward edge north of the equatorward edge", () => {
    for (let kp = 0; kp <= 9; kp += 0.5) {
      for (let mlt = 0; mlt < 24; mlt += 1.5) {
        const { equatorward, poleward } = ovalBoundaries(kp, mlt);
        expect(poleward, `kp ${kp} mlt ${mlt}`).toBeGreaterThan(equatorward);
      }
    }
  });

  it("caps activity where the model stops being valid", () => {
    expect(ovalBoundaries(9, 0)).toEqual(ovalBoundaries(OVAL_MAX_KP, 0));
    expect(ovalBoundaries(-1, 0)).toEqual(ovalBoundaries(0, 0));
  });
});
