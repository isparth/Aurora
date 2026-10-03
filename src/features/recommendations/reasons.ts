import type { ConditionsAtTime, NearbyCamera, RoadSafety, ScoreComponents, ViewingLocation } from "@/domain/types";
import { formatApproxDuration, formatTime } from "@/lib/time";

export type ReasonContext = {
  location: ViewingLocation;
  windowStart: number;
  windowEnd: number;
  peakTime: number;
  peakScore: number;
  peak: ConditionsAtTime;
  peakComponents: ScoreComponents;
  /** NOAA's real-time estimated Kp, when fresh. */
  kpNow: number | null;
  road: RoadSafety;
  camera?: NearbyCamera;
  moonUpDuringWindow: boolean;
  missedPeak: { time: number; score: number } | null;
  winterAccessConcern: boolean;
  /** Strongest gust forecast during the window, km/h. */
  maxGustKph?: number;
};

const pct = (fraction: number) => Math.round(fraction * 100);
const kpText = (kp: number) => kp.toFixed(1).replace(/\.0$/, "");
const MAX_REASONS = 5;

/**
 * Deterministic, data-derived explanations. No language model is involved, so every sentence
 * can be traced back to a number in the forecast or the model.
 */
export function buildReasons(ctx: ReasonContext): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const { peak, location, peakComponents: c } = ctx;
  const at = formatTime(ctx.peakTime);
  const clouds = peak.clouds;

  if (ctx.camera?.observation?.usable && ctx.camera.observation.auroraVisible && ctx.camera.observation.confidence >= 0.6)
    reasons.push("A nearby road camera appears to show aurora right now.");

  if (clouds.total <= 0.12) reasons.push(`Only ${pct(clouds.total)}% cloud cover is forecast around ${at}.`);
  else if (clouds.total <= 0.3) reasons.push(`Mostly clear skies (${pct(clouds.total)}% cloud) are expected around ${at}.`);
  else if (clouds.effective <= 0.25) reasons.push(`Mostly thin, high cloud around ${at} — moderate aurora shines through it.`);
  else if (clouds.effective <= 0.6) reasons.push(`Partly cloudy (${pct(clouds.total)}%) around ${at}, so gaps in the cloud are likely.`);
  else warnings.push(`Heavy cloud (${pct(clouds.effective)}% low and mid-level) is forecast even at the best time.`);

  if (peak.kpSource === "typical") warnings.push("No aurora activity forecast is available — the chance assumes a typical night.");
  if (c.oval.position === "overhead") reasons.push(`The auroral oval is expected overhead around ${at} (activity Kp ≈ ${kpText(c.kp)}).`);
  else if (c.oval.elevationDeg >= 25) reasons.push(`At Kp ≈ ${kpText(c.kp)} the aurora should be fairly high in the northern sky around ${at}.`);
  else warnings.push(`Activity is modest (Kp ≈ ${kpText(c.kp)}): any aurora will be low in the northern sky — pick an open view north.`);
  if (ctx.kpNow !== null && ctx.kpNow < 1.5 && c.kp >= ctx.kpNow + 1)
    warnings.push(`Activity is quiet right now (Kp ${kpText(ctx.kpNow)}); it is forecast to pick up later — check again before you leave.`);

  if (location.scenery >= 0.85) reasons.push(`Iconic setting: ${location.highlight}.`);
  else if (location.scenery >= 0.65) reasons.push(`Scenic setting: ${location.highlight}.`);

  const minutes = (ctx.windowEnd - ctx.windowStart) / 60_000;
  if (minutes >= 60) reasons.push(`The best spell lasts roughly ${formatApproxDuration(minutes)}.`);
  else warnings.push(`Only a short spell (${formatTime(ctx.windowStart)}–${formatTime(ctx.windowEnd)}).`);

  switch (c.brightSky) {
    case "moon":
      warnings.push(`A bright moon (${pct(peak.moonIllumination)}% lit) raises the bar: only moderate or strong aurora will stand out.`);
      break;
    case "twilight":
      warnings.push("The sky is still bright with twilight — only strong aurora shows until it gets darker.");
      break;
    case "lights":
      warnings.push("Some glow from nearby towns — face away from the lights; faint aurora may be lost.");
      break;
    default:
      reasons.push(ctx.moonUpDuringWindow ? "Dark sky: even faint aurora will show." : "Dark, moonless sky: even faint aurora will show.");
  }

  const obs = ctx.camera?.observation;
  if (obs?.usable && obs.skyVisible && obs.estimatedCloudCover !== undefined) {
    if (obs.estimatedCloudCover <= 0.35) reasons.push("A nearby road camera suggests mostly clear skies.");
    else if (obs.estimatedCloudCover >= 0.7) warnings.push("A nearby road camera currently shows mostly cloudy skies.");
  }

  switch (ctx.road.status) {
    case "good":
      reasons.push(
        ctx.road.coverage === "route"
          ? "Roads on the way are reported easily passable."
          : "Roads near the destination are reported easily passable.",
      );
      break;
    case "caution":
      warnings.push(`${ctx.road.description ?? "Slippery sections"} — drive carefully.`);
      break;
    case "difficult":
    case "closed":
      warnings.push(`Road warning: ${ctx.road.description ?? "serious conditions reported"}.`);
      break;
    default:
      warnings.push("Road conditions unavailable — check umferdin.is before you travel.");
  }

  if (location.normalCarAccessible && location.parkingAvailable) reasons.push("Accessible by normal car, with parking.");
  if (ctx.winterAccessConcern) warnings.push("Access can be difficult in winter — check road conditions first.");

  const gust = ctx.maxGustKph;
  if (gust !== undefined && gust >= 90) warnings.push(`Dangerous gusts up to ${Math.round(gust)} km/h are forecast — driving and standing outside will be hazardous.`);
  else if (gust !== undefined && gust >= 72) warnings.push(`Strong gusts up to ${Math.round(gust)} km/h — hold car doors firmly and take care on exposed roads.`);
  else if (peak.windKph !== undefined && peak.windKph >= 40) warnings.push(`Strong wind around ${Math.round(peak.windKph)} km/h — it will feel bitterly cold.`);
  if (peak.temperatureC !== undefined && peak.temperatureC <= -8)
    warnings.push(`Very cold (${Math.round(peak.temperatureC)}°C) — dress in warm layers.`);
  if (peak.precipitationMm !== undefined && peak.precipitationMm >= 0.3) warnings.push("Showers are possible during the window.");
  if (peak.visibilityKm !== undefined && peak.visibilityKm < 3) warnings.push("Poor visibility (fog or haze) is possible.");

  if (ctx.missedPeak && ctx.missedPeak.score >= ctx.peakScore + 8)
    warnings.push(`The chance peaks around ${formatTime(ctx.missedPeak.time)}, before you could get there.`);

  return { reasons: reasons.slice(0, MAX_REASONS), warnings };
}
