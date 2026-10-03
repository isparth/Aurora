import { clamp01, smoothstep } from "./math";

export type CloudLayers = { total: number; low?: number; middle?: number; high?: number };

/**
 * Cloud that hides the aurora: low (< 3 km) and mid-level (3–8 km) layers, combined as independent layers.
 * Mid-level cloud is sometimes thin, so it counts 90%. Thin high cloud is left out here — it only dims the
 * aurora (see the aurora-visibility model). Total cloud minus high cloud is a floor, so inconsistent layer
 * data can't make an overcast sky look clear.
 */
export function opaqueCloud(c: CloudLayers): number {
  if (c.low === undefined || c.middle === undefined || c.high === undefined) return clamp01(c.total);
  const layered = 1 - (1 - clamp01(c.low)) * (1 - 0.9 * clamp01(c.middle));
  return clamp01(Math.max(layered, c.total - c.high));
}

/** Chance of a usable sky on an Icelandic winter night (mean cloud ≈ 75–80%): what a forecast decays towards. */
export const CLIMATOLOGICAL_VIEW = 0.3;

/** Weight given to the cloud forecast: high in the next hours, lower overnight as forecast skill fades. */
export const forecastWeight = (leadHours: number) => 1 - Math.min(0.3, 0.05 + 0.015 * Math.max(0, leadHours));

/**
 * Chance that the sky towards the aurora is open enough to see it during the half hour.
 * Broken cloud leaves gaps that move: 1 − c² overhead, closer to 1 − c low on the horizon where the line of
 * sight crosses much more cloud. Fog and falling precipitation obstruct further.
 */
export function skyViewProbability(p: {
  clouds: CloudLayers;
  precipitationMm?: number;
  visibilityKm?: number;
  /** Elevation of the aurora above the horizon, degrees. */
  elevationDeg: number;
  /** Hours between now and the half hour being scored. */
  leadHours: number;
}): number {
  const c = opaqueCloud(p.clouds);
  const gapPower = 1 + smoothstep(10, 50, p.elevationDeg);
  const precipitation = p.precipitationMm === undefined ? 1 : 1 - 0.5 * smoothstep(0.05, 0.4, p.precipitationMm);
  const visibility = p.visibilityKm === undefined ? 1 : 0.1 + 0.9 * smoothstep(0.5, 5, p.visibilityKm);
  const forecast = (1 - c ** gapPower) * precipitation * visibility;
  const w = forecastWeight(p.leadHours);
  return w * forecast + (1 - w) * CLIMATOLOGICAL_VIEW * precipitation * visibility;
}
