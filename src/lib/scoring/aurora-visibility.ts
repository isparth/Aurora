import type { AuroraPosition, BrightSky, LimitingFactor, ScoreComponents } from "@/domain/types";

import { ovalBoundaries } from "./auroral-oval";
import { clamp01, DEG, normalCdf, smoothstep } from "./math";
import {
  angularSeparationDeg,
  artificialLuminance,
  extinctionDex,
  moonLuminance,
  NATURAL_SKY_CD,
  naturalSkyLuminance,
  twilightLuminance,
  visualThresholdKr,
} from "./sky-brightness";

/**
 * Clear-sky chance that aurora bright enough for the naked eye is in view during a half hour.
 *
 * The brightest aurora in view is log-normal. Its median rises with Kp and falls with the distance between
 * the site and the auroral oval (Starkov model); it is visible when it beats the eye's threshold against
 * tonight's sky (twilight, moon, town glow). Constants marked "calibrated" were fitted so the model
 * reproduces the Finnish Meteorological Institute's all-sky-camera statistics — the share of clear dark
 * nights with aurora at stations from 56° to 67° geomagnetic latitude, 1973–1997, driven by the observed
 * GFZ Kp record (`npm run calibrate`, scripts/calibrate-aurora.calibration.ts).
 */
export const AURORA_MODEL = {
  /** log10 kR: median brightness of the brightest aurora in view under the oval at Kp 0, substorm sector. Calibrated. */
  medianLogKrAtKp0: 0.35,
  /** log10 kR per Kp: slope of the oval's peak energy flux with Kp (Zhang & Paxton 2008, Sigernes et al. 2011 Table 3). */
  logKrPerKp: 0.117,
  /** Spread (log10) of the brightest aurora within a half hour, i.e. whether a substorm brightening happens. */
  sigma: 0.45,
  /** Median substorm-onset magnetic local time (Frey et al. 2004) and the width of the active sector, hours. */
  substormMlt: 23,
  substormWidthHours: 3.5,
  /** log10: how much fainter displays typically are far from the substorm sector. */
  quietSectorDeficit: 0.25,
  /** log10 per degree of geomagnetic latitude between the site and the oval's edge. Calibrated (fits 0.5–0.9). */
  fadePerDegree: 0.6,
  /** Effective emission height for the viewing geometry, km. */
  emissionHeightKm: 150,
  /** Typical horizon obstruction (terrain, low haze), degrees. */
  horizonDeg: 3,
  /** Thin high cloud (cirrus) transmits ~40% at full cover. */
  cirrusDimming: 0.6,
  /** Azimuth of the oval seen from Iceland when it lies to the north (towards the geomagnetic pole), degrees. */
  ovalAzimuthDeg: 340,
} as const;

export type AuroraGeometry = { ovalDistanceDeg: number; elevationDeg: number; position: AuroraPosition };
export type SkyConditions = {
  sunAltitudeDeg: number;
  moon: { altitudeDeg: number; azimuthDeg: number; illumination: number };
  /** Site light-pollution score, 0 = urban … 1 = pristine. */
  lightPollutionScore: number;
  /** High-cloud fraction 0–1. */
  highCloud: number;
};
export type AuroraVisibility = {
  probability: number;
  /** Faintest visible aurora against this sky, kR (≈1 in a natural dark sky). */
  thresholdKr: number;
  /** Median brightness of the brightest aurora expected in view, kR. */
  medianKr: number;
  brightSky: BrightSky;
  geometry: AuroraGeometry;
};

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111.2;

export function magneticLocalTime(utcHour: number, magneticMidnightUtc: number): number {
  return (((utcHour - magneticMidnightUtc) % 24) + 24) % 24;
}

/** Where the oval is relative to the site, and how high above the horizon its aurora appears. */
export function auroraGeometry(kp: number, mlt: number, cgmLatitude: number): AuroraGeometry {
  const { equatorward, poleward } = ovalBoundaries(kp, mlt);
  const position: AuroraPosition = cgmLatitude < equatorward ? "north" : cgmLatitude > poleward ? "south" : "overhead";
  const ovalDistanceDeg = position === "north" ? equatorward - cgmLatitude : position === "south" ? cgmLatitude - poleward : 0;
  if (ovalDistanceDeg === 0) return { ovalDistanceDeg, elevationDeg: 90, position };
  const km = ovalDistanceDeg * KM_PER_DEGREE;
  const elevationDeg = Math.atan2(AURORA_MODEL.emissionHeightKm, km) / DEG - km / (2 * EARTH_RADIUS_KM) / DEG;
  return { ovalDistanceDeg, elevationDeg, position };
}

function brightestSource(twilight: number, moon: number, lights: number): BrightSky {
  if (twilight + moon + lights < 0.6 * NATURAL_SKY_CD) return null;
  if (twilight >= moon && twilight >= lights) return "twilight";
  return moon >= lights ? "moon" : "lights";
}

/**
 * What holds a half hour back most. Clouds when the sky view is the weaker gate; otherwise compare, in
 * log-brightness, how much the bright sky raises the bar against how much the aurora loses by being far
 * from the oval (i.e. activity too low for this latitude).
 */
export function limitingFactor(c: Pick<ScoreComponents, "skyView" | "aurora" | "thresholdKr" | "oval">): LimitingFactor {
  if (c.skyView <= c.aurora) return "clouds";
  const skyPenalty = Math.log10(Math.max(1, c.thresholdKr));
  const distancePenalty = AURORA_MODEL.fadePerDegree * c.oval.distanceDeg;
  return c.thresholdKr >= 2 && skyPenalty > distancePenalty ? "bright-sky" : "activity";
}

export function auroraVisibility(p: { kp: number; mlt: number; cgmLatitude: number; sky: SkyConditions }): AuroraVisibility {
  const m = AURORA_MODEL;
  const geometry = auroraGeometry(p.kp, p.mlt, p.cgmLatitude);
  // Inside the oval you can face away from the moon and look up; otherwise you look towards the oval.
  const look =
    geometry.position === "overhead"
      ? { altitudeDeg: 90, azimuthDeg: 0 }
      : { altitudeDeg: geometry.elevationDeg, azimuthDeg: geometry.position === "north" ? m.ovalAzimuthDeg : m.ovalAzimuthDeg - 180 };

  const twilight = twilightLuminance(p.sky.sunAltitudeDeg);
  const moon = moonLuminance({
    moonAltitudeDeg: p.sky.moon.altitudeDeg,
    illumination: p.sky.moon.illumination,
    separationDeg: angularSeparationDeg(look, p.sky.moon),
    viewZenithDeg: 90 - look.altitudeDeg,
  });
  const lights = artificialLuminance(p.sky.lightPollutionScore);
  const thresholdKr = visualThresholdKr(naturalSkyLuminance(look.altitudeDeg) + twilight + moon + lights);

  let fromSubstorm = p.mlt - m.substormMlt;
  fromSubstorm -= 24 * Math.round(fromSubstorm / 24);
  const logMedian =
    m.medianLogKrAtKp0 +
    m.logKrPerKp * p.kp +
    m.quietSectorDeficit * (Math.exp(-(fromSubstorm ** 2) / (2 * m.substormWidthHours ** 2)) - 1) -
    m.fadePerDegree * geometry.ovalDistanceDeg -
    extinctionDex(geometry.elevationDeg) +
    Math.log10(1 - m.cirrusDimming * clamp01(p.sky.highCloud));

  const aboveHorizon = smoothstep(m.horizonDeg, m.horizonDeg + 6, geometry.elevationDeg);
  return {
    probability: aboveHorizon * normalCdf((logMedian - Math.log10(thresholdKr)) / m.sigma),
    thresholdKr,
    medianKr: 10 ** logMedian,
    brightSky: brightestSource(twilight, moon, lights),
    geometry,
  };
}
