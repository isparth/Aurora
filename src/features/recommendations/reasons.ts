import type { ConditionsAtTime, NearbyCamera, RoadSafety, ViewingLocation } from "@/domain/types";
import { formatApproxDuration, formatTime } from "@/lib/time";

export type ReasonContext = {
  location: ViewingLocation;
  windowStart: number;
  windowEnd: number;
  peakTime: number;
  peakScore: number;
  peak: ConditionsAtTime;
  auroraActivity: number | null;
  road: RoadSafety;
  camera?: NearbyCamera;
  moonUpDuringWindow: boolean;
  missedPeak: { time: number; score: number } | null;
  winterAccessConcern: boolean;
};

const pct = (fraction: number) => Math.round(fraction * 100);
const MAX_REASONS = 5;

/**
 * Deterministic, data-derived explanations. No language model is involved, so every sentence
 * can be traced back to a number in the forecast.
 */
export function buildReasons(ctx: ReasonContext): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const { peak, location } = ctx;
  const at = formatTime(ctx.peakTime);
  const clouds = peak.clouds;
  const lowerClouds = Math.max(clouds.low ?? clouds.total, clouds.middle ?? 0);

  if (clouds.total <= 0.12) reasons.push(`Only ${pct(clouds.total)}% cloud cover is forecast around ${at}.`);
  else if (clouds.total <= 0.3) reasons.push(`Mostly clear skies (${pct(clouds.total)}% cloud) are expected around ${at}.`);
  else if (lowerClouds <= 0.25 && clouds.effective <= 0.6) reasons.push(`Mostly thin, high cloud around ${at} — aurora can shine through it.`);
  else if (clouds.effective <= 0.6) reasons.push(`Partly cloudy (${pct(clouds.total)}%) around ${at}, so gaps in the cloud are likely.`);
  else warnings.push(`Heavy cloud (${pct(clouds.total)}%) is forecast even at the best time.`);

  const minutes = (ctx.windowEnd - ctx.windowStart) / 60_000;
  if (minutes >= 60) reasons.push(`Favourable conditions last for roughly ${formatApproxDuration(minutes)}.`);
  else warnings.push(`Only a short favourable window (${formatTime(ctx.windowStart)}–${formatTime(ctx.windowEnd)}).`);

  if (location.lightPollutionScore >= 0.9) reasons.push("The location has very little light pollution.");
  else if (location.lightPollutionScore >= 0.75) reasons.push("Low light pollution, away from town lights.");
  else if (location.lightPollutionScore < 0.55) warnings.push("Some glow from nearby towns — face north, away from the lights.");

  if (ctx.auroraActivity === null) warnings.push("Aurora activity forecast unavailable — the score reflects sky conditions only.");
  else if (ctx.auroraActivity >= 5) reasons.push(`Strong aurora activity is forecast tonight (${ctx.auroraActivity}/9).`);
  else if (ctx.auroraActivity >= 3) reasons.push(`Aurora activity is forecast at ${ctx.auroraActivity}/9.`);
  else warnings.push(`Aurora activity is low tonight (${ctx.auroraActivity}/9), so displays may be faint.`);

  const obs = ctx.camera?.observation;
  if (obs?.usable) {
    if (obs.auroraVisible && obs.confidence >= 0.6) reasons.unshift("A nearby road camera appears to show aurora right now.");
    else if (obs.skyVisible && obs.estimatedCloudCover !== undefined && obs.estimatedCloudCover <= 0.35)
      reasons.push("A nearby road camera suggests mostly clear skies.");
    else if (obs.skyVisible && obs.estimatedCloudCover !== undefined && obs.estimatedCloudCover >= 0.7)
      warnings.push("A nearby road camera currently shows mostly cloudy skies.");
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

  if (ctx.moonUpDuringWindow && peak.moonIllumination >= 0.5)
    warnings.push(`A bright moon (${pct(peak.moonIllumination)}% lit) will wash out fainter aurora.`);
  else if (!ctx.moonUpDuringWindow) reasons.push("No moonlight during the best window.");

  if (location.normalCarAccessible && location.parkingAvailable) reasons.push("Accessible by normal car, with parking.");
  if (ctx.winterAccessConcern) warnings.push("Access can be difficult in winter — check road conditions first.");

  if (peak.windKph !== undefined && peak.windKph >= 40)
    warnings.push(`Strong wind around ${Math.round(peak.windKph)} km/h — it will feel bitterly cold.`);
  if (peak.temperatureC !== undefined && peak.temperatureC <= -8)
    warnings.push(`Very cold (${Math.round(peak.temperatureC)}°C) — dress in warm layers.`);
  if (peak.precipitationMm !== undefined && peak.precipitationMm >= 0.3) warnings.push("Showers are possible during the window.");
  if (peak.visibilityKm !== undefined && peak.visibilityKm < 3) warnings.push("Poor visibility (fog or haze) is possible.");

  if (ctx.missedPeak && ctx.missedPeak.score >= ctx.peakScore + 8)
    warnings.push(`Conditions peak around ${formatTime(ctx.missedPeak.time)}, before you could get there.`);

  return { reasons: reasons.slice(0, MAX_REASONS), warnings };
}
