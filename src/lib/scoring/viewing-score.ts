import type { ScoreComponents, ViewingScore } from "@/domain/types";

/**
 * How much each factor contributes to the 0–100 viewing score.
 * Missing optional factors (camera, or aurora when IMO is unavailable) are dropped
 * and the remaining weights are renormalised, so absent data never counts as bad data.
 */
export const VIEWING_WEIGHTS = {
  clouds: 0.4,
  aurora: 0.25,
  darkness: 0.15,
  lightPollution: 0.1,
  weather: 0.05,
  camera: 0.05,
} as const;

export type ViewingInputs = {
  /** Effective cloud cover, 0–1 (see `effectiveCloudCover`). */
  cloudCover: number;
  /** IMO activity 0–9, or null when the forecast is unavailable. */
  auroraActivity: number | null;
  /** Sky darkness 0–1 including moonlight. */
  darkness: number;
  /** Darkness from the sun only, 0–1. Used for the daylight limiter. Defaults to `darkness`. */
  sunDarkness?: number;
  /** 0 = urban glow, 1 = extremely dark site. */
  lightPollution: number;
  /** 0–1, from precipitation, visibility and wind. */
  weatherQuality: number;
  /** 0–1 clear-sky evidence from a nearby road camera, when one was analysed. */
  cameraConfidence?: number;
  /** Strong positive evidence: a camera currently shows aurora. */
  cameraSeesAurora?: boolean;
  /** 0.85–1 multiplier for time of night (activity peaks near magnetic midnight). */
  auroraTimeFactor?: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function interpolate(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * Low and mid clouds block the aurora almost completely; thin high cloud (cirrus) only dims it.
 * Layers are combined as independent coverage; total cloud is a floor so inconsistent layer
 * data cannot make an overcast sky look clear.
 */
export function effectiveCloudCover(c: { total: number; low?: number; middle?: number; high?: number }): number {
  if (c.low === undefined || c.middle === undefined || c.high === undefined) return clamp01(c.total);
  const layered = 1 - (1 - c.low) * (1 - 0.9 * c.middle) * (1 - 0.45 * c.high);
  return clamp01(Math.max(layered, 0.5 * c.total));
}

/** IMO activity (0–9) → 0–100. Iceland sits under the auroral oval, so even low activity can show. */
const AURORA_ACTIVITY_SCORE = [5, 25, 45, 62, 76, 86, 93, 97, 99, 100] as const;

export function auroraActivityScore(activity: number): number {
  const a = Math.min(9, Math.max(0, activity));
  const lo = Math.floor(a);
  const hi = Math.min(9, lo + 1);
  return AURORA_ACTIVITY_SCORE[lo] + (AURORA_ACTIVITY_SCORE[hi] - AURORA_ACTIVITY_SCORE[lo]) * (a - lo);
}

/**
 * Substorm activity is most likely around magnetic midnight (~23:30 in Iceland).
 * A gentle prior: 1.0 at the peak, never below 0.85.
 */
export function auroraTimeFactor(utcHourOfDay: number): number {
  let delta = utcHourOfDay - 23.5;
  if (delta < -12) delta += 24;
  if (delta > 12) delta -= 24;
  return 0.85 + 0.15 * Math.exp(-(delta * delta) / (2 * 2.5 * 2.5));
}

export function weatherQuality(w: { precipitationMm?: number; visibilityKm?: number; windKph?: number }): number {
  const precip = w.precipitationMm === undefined ? 1 : interpolate([[0, 1], [0.1, 0.9], [0.5, 0.5], [1.5, 0.1]], w.precipitationMm);
  const vis = w.visibilityKm === undefined ? 1 : interpolate([[0.5, 0.05], [1, 0.2], [4, 0.6], [10, 0.9], [20, 1]], w.visibilityKm);
  const wind = w.windKph === undefined ? 1 : interpolate([[20, 1], [35, 0.85], [55, 0.55], [75, 0.2]], w.windKph);
  return clamp01(precip * vis * wind);
}

/**
 * Viewing score: "how good will the sky be for seeing aurora?" (0–100).
 *
 * 1. A weighted average of components expresses trade-offs (VIEWING_WEIGHTS).
 * 2. Limiting factors then scale it down, because no amount of darkness helps under overcast
 *    skies, nothing helps in daylight, and a perfect sky with no activity is not "excellent".
 */
export function computeViewingScore(inputs: ViewingInputs): ViewingScore {
  const clearSky = 1 - clamp01(inputs.cloudCover);
  const auroraBase = inputs.auroraActivity === null ? null : auroraActivityScore(inputs.auroraActivity);
  let aurora = auroraBase === null ? null : auroraBase * (inputs.auroraTimeFactor ?? 1);
  if (inputs.cameraSeesAurora) aurora = Math.max(aurora ?? 0, 92);

  const components: ScoreComponents = {
    clouds: 100 * clearSky,
    aurora,
    darkness: 100 * clamp01(inputs.darkness),
    lightPollution: 100 * clamp01(inputs.lightPollution),
    weather: 100 * clamp01(inputs.weatherQuality),
    camera: inputs.cameraConfidence === undefined ? null : 100 * clamp01(inputs.cameraConfidence),
  };

  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(VIEWING_WEIGHTS) as (keyof typeof VIEWING_WEIGHTS)[]) {
    const value = components[key];
    if (value === null) continue;
    weighted += VIEWING_WEIGHTS[key] * value;
    weightSum += VIEWING_WEIGHTS[key];
  }
  const average = weightSum > 0 ? weighted / weightSum : 0;

  const cloudLimiter = 0.1 + 0.9 * smoothstep(0, 0.7, clearSky);
  const daylightLimiter = smoothstep(0, 0.6, inputs.sunDarkness ?? inputs.darkness);
  const activityLimiter = aurora === null ? 1 : 0.45 + 0.55 * smoothstep(0, 0.65, aurora / 100);

  return {
    overall: Math.round(Math.min(100, Math.max(0, average * cloudLimiter * daylightLimiter * activityLimiter))),
    components: {
      clouds: Math.round(components.clouds),
      aurora: components.aurora === null ? null : Math.round(components.aurora),
      darkness: Math.round(components.darkness),
      lightPollution: Math.round(components.lightPollution),
      weather: Math.round(components.weather),
      camera: components.camera === null ? null : Math.round(components.camera),
    },
  };
}
