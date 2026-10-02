import type { CameraObservation, ConditionsAtTime, HourlyWeather, ScoreComponents, ViewingLocation } from "@/domain/types";
import { combinedDarkness, moonState, sunAltitude, sunDarkness } from "@/lib/astronomy/darkness";
import {
  auroraTimeFactor,
  computeViewingScore,
  effectiveCloudCover,
  weatherQuality,
} from "@/lib/scoring/viewing-score";
import {
  computeDeparture,
  earliestViewingTime,
  findBestWindow,
  isReachable,
  roundUpToFiveMinutes,
  SLOT_MS,
  type ViewingWindow,
} from "@/lib/scoring/windows";
import { HOUR, MINUTE, utcHourOfDay } from "@/lib/time";

export type SlotEvaluation = {
  time: number;
  score: number;
  components: ScoreComponents;
  conditions: ConditionsAtTime;
};

/** A camera image describes "now"; it only informs the next couple of hours. */
export const CAMERA_EVIDENCE_HORIZON_MS = 2 * HOUR;

const lerp = (a: number | undefined, b: number | undefined, f: number) =>
  a === undefined ? b : b === undefined ? a : a + (b - a) * f;

export function interpolateWeather(hourly: HourlyWeather[], t: number): HourlyWeather | null {
  if (hourly.length === 0) return null;
  const first = hourly[0];
  const last = hourly[hourly.length - 1];
  if (t < first.time) return first.time - t <= 30 * MINUTE ? first : null;
  if (t >= last.time) return t - last.time <= 30 * MINUTE ? last : null;
  let i = 0;
  while (hourly[i + 1].time <= t) i++;
  const a = hourly[i];
  const b = hourly[i + 1];
  const f = (t - a.time) / (b.time - a.time);
  return {
    time: t,
    cloudTotal: lerp(a.cloudTotal, b.cloudTotal, f) as number,
    cloudLow: lerp(a.cloudLow, b.cloudLow, f),
    cloudMid: lerp(a.cloudMid, b.cloudMid, f),
    cloudHigh: lerp(a.cloudHigh, b.cloudHigh, f),
    temperatureC: lerp(a.temperatureC, b.temperatureC, f),
    precipitationMm: lerp(a.precipitationMm, b.precipitationMm, f),
    visibilityKm: lerp(a.visibilityKm, b.visibilityKm, f),
    windKph: lerp(a.windKph, b.windKph, f),
    gustKph: lerp(a.gustKph, b.gustKph, f),
  };
}

/** Score every 30-minute slot of the night for one location (the location × time grid). */
export function evaluateSlots(params: {
  location: ViewingLocation;
  hourly: HourlyWeather[];
  slots: number[];
  auroraActivity: number | null;
  now: number;
  camera?: CameraObservation | null;
}): SlotEvaluation[] {
  const { location, hourly, slots, auroraActivity, now, camera } = params;
  const point = { lat: location.latitude, lon: location.longitude };
  const out: SlotEvaluation[] = [];

  for (const slot of slots) {
    const mid = slot + SLOT_MS / 2;
    const w = interpolateWeather(hourly, mid);
    if (!w) continue;

    const sunAlt = sunAltitude(mid, point);
    const moon = moonState(mid, point);
    const clouds = { total: w.cloudTotal, low: w.cloudLow, middle: w.cloudMid, high: w.cloudHigh };
    const effective = effectiveCloudCover(clouds);
    const darkness = combinedDarkness(sunAlt, moon.illumination, moon.altitude);

    const cameraFresh = camera ? mid - now <= CAMERA_EVIDENCE_HORIZON_MS : false;
    const cameraSky =
      camera && cameraFresh && camera.usable && camera.skyVisible && camera.confidence >= 0.4 && camera.estimatedCloudCover !== undefined
        ? 1 - camera.estimatedCloudCover
        : undefined;

    const { overall, components } = computeViewingScore({
      cloudCover: effective,
      auroraActivity,
      darkness,
      sunDarkness: sunDarkness(sunAlt),
      lightPollution: location.lightPollutionScore,
      weatherQuality: weatherQuality(w),
      cameraConfidence: cameraSky,
      cameraSeesAurora: Boolean(camera && cameraFresh && camera.auroraVisible && camera.confidence >= 0.6),
      auroraTimeFactor: auroraTimeFactor(utcHourOfDay(mid)),
    });

    out.push({
      time: slot,
      score: overall,
      components,
      conditions: {
        time: new Date(slot).toISOString(),
        clouds: { ...clouds, effective },
        auroraActivity,
        darkness,
        sunAltitude: sunAlt,
        moonIllumination: moon.illumination,
        moonAltitude: moon.altitude,
        temperatureC: w.temperatureC,
        windKph: w.windKph,
        gustKph: w.gustKph,
        precipitationMm: w.precipitationMm,
        visibilityKm: w.visibilityKm,
      },
    });
  }
  return out;
}

export type VisitPlan = {
  earliestViewing: number;
  reachable: boolean[];
  window: ViewingWindow | null;
  windowStart: number | null;
  windowEnd: number | null;
  viewingScore: number;
  peakScore: number;
  /** Best slot of the whole night, ignoring travel time. */
  nightPeak: { time: number; score: number } | null;
  departure: { departure: number; leaveNow: boolean; bufferMinutes: number } | null;
};

/** Apply travel time: drop slots the user cannot reach, then find the best window and departure. */
export function planVisit(evaluations: SlotEvaluation[], now: number, driveMinutes: number): VisitPlan {
  const earliestViewing = earliestViewingTime(now, driveMinutes);
  const reachable = evaluations.map((e) => isReachable(e.time, earliestViewing));
  const window = findBestWindow(evaluations.map((e, i) => ({ time: e.time, score: e.score, reachable: reachable[i] })));
  const nightPeak = evaluations.reduce<{ time: number; score: number } | null>(
    (best, e) => (best === null || e.score > best.score ? { time: e.time, score: e.score } : best),
    null,
  );

  if (!window) {
    return { earliestViewing, reachable, window, windowStart: null, windowEnd: null, viewingScore: 0, peakScore: 0, nightPeak, departure: null };
  }
  const windowStart = Math.max(evaluations[window.startIndex].time, roundUpToFiveMinutes(earliestViewing));
  const windowEnd = evaluations[window.endIndex].time + SLOT_MS;
  return {
    earliestViewing,
    reachable,
    window,
    windowStart,
    windowEnd,
    viewingScore: Math.round(window.averageScore),
    peakScore: window.peakScore,
    nightPeak,
    departure: computeDeparture({ windowStart, now, driveMinutes }),
  };
}
