import { DEG } from "./math";

/**
 * Statistical auroral oval of Starkov (1994a): the poleward and equatorward edges of the (discrete)
 * auroral oval in corrected geomagnetic latitude, as a function of activity and magnetic local time.
 * Coefficients as reproduced in Sigernes et al. (2011), "Two methods to forecast auroral displays",
 * J. Space Weather Space Clim. 1, A03, Appendix A; Kp is converted to AL with Starkov (1994b).
 */
type Polynomial = readonly [number, number, number, number];
type Coefficients = Record<"A0" | "A1" | "A2" | "A3" | "a1" | "a2" | "a3", Polynomial>;

const POLEWARD: Coefficients = {
  A0: [-0.07, 24.54, -12.53, 2.15],
  A1: [-10.06, 19.83, -9.33, 1.24],
  A2: [-4.44, 7.47, -3.01, 0.25],
  A3: [-3.77, 7.9, -4.73, 0.91],
  a1: [-6.61, 10.17, -5.8, 1.19],
  a2: [6.37, -1.1, 0.34, -0.38],
  a3: [-4.48, 10.16, -5.87, 0.98],
};

const EQUATORWARD: Coefficients = {
  A0: [1.61, 23.21, -10.97, 2.03],
  A1: [-9.59, 17.78, -7.2, 0.96],
  A2: [-12.07, 17.49, -7.96, 1.15],
  A3: [-6.56, 11.44, -6.73, 1.31],
  a1: [-2.22, 1.5, -0.58, 0.08],
  a2: [-23.98, 42.79, -26.96, 5.56],
  a3: [-20.07, 36.67, -24.2, 5.11],
};

/** The model is validated up to about Kp 7; by then every Icelandic site is under the oval anyway. */
export const OVAL_MAX_KP = 7;

/** AL index (nT, magnitude) from Kp (Starkov 1994b). */
export const kpToAl = (kp: number) => 18 - 12.3 * kp + 27.2 * kp ** 2 - 2 * kp ** 3;

const poly = ([b0, b1, b2, b3]: Polynomial, x: number) => b0 + b1 * x + b2 * x * x + b3 * x * x * x;

/** Corrected geomagnetic latitude of one boundary (colatitude Fourier series in MLT hours, 15°/h). */
function boundary(c: Coefficients, logAl: number, mlt: number): number {
  const p = (key: keyof Coefficients) => poly(c[key], logAl);
  const colatitude =
    p("A0") +
    p("A1") * Math.cos(15 * (mlt + p("a1")) * DEG) +
    p("A2") * Math.cos(15 * (2 * mlt + p("a2")) * DEG) +
    p("A3") * Math.cos(15 * (3 * mlt + p("a3")) * DEG);
  return 90 - colatitude;
}

/** Edges of the auroral oval (CGM latitude, degrees) for an activity level and magnetic local time (hours). */
export function ovalBoundaries(kp: number, mlt: number): { equatorward: number; poleward: number } {
  // The Kp→AL polynomial dips slightly below its Kp 0 value up to Kp ≈ 0.47; hold it there so the oval
  // never retreats as activity rises.
  const logAl = Math.log10(Math.max(kpToAl(0), kpToAl(Math.min(OVAL_MAX_KP, Math.max(0, kp)))));
  return { equatorward: boundary(EQUATORWARD, logAl, mlt), poleward: boundary(POLEWARD, logAl, mlt) };
}
