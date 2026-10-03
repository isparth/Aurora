import type { CameraObservation, ConditionsAtTime, HourlyWeather, ScoreComponents, ViewingLocation } from "@/domain/types";
import { moonState, sunAltitude } from "@/lib/astronomy/darkness";
import { activityAt, kpScenarios, SCENARIO_WEIGHTS, type ActivityInputs } from "@/lib/scoring/activity";
import { auroraVisibility, magneticLocalTime } from "@/lib/scoring/aurora-visibility";
import { findBestWindow, sessionChance, type ViewingWindow } from "@/lib/scoring/chance";
import { opaqueCloud, skyViewProbability } from "@/lib/scoring/sky-view";
import { computeDeparture, earliestViewingTime, isReachable, roundUpToFiveMinutes, SLOT_MS } from "@/lib/scoring/windows";
import { HOUR, MINUTE, utcHourOfDay } from "@/lib/time";

export type SlotEvaluation = {
  time: number;
  /** 0–1 chance of seeing aurora during this half hour (averaged over activity scenarios). */
  chance: number;
  /** 0–100, rounded, for display. */
  score: number;
  /** Chance under each activity scenario (0–1), shared across the night for the window calculation. */
  scenarios: number[];
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
  while (i < hourly.length - 2 && hourly[i + 1].time <= t) i++;
  const a = hourly[i];
  const b = hourly[i + 1];
  if (b.time <= a.time) return null;
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

/**
 * What a fresh camera image says about the next hours: its cloud estimate is blended into the forecast
 * (weight fading over ~1.5 h), and a camera that shows aurora raises the chance that aurora is present over
 * the next ~45 minutes. A camera that shows no aurora never lowers it — road cameras rarely resolve faint aurora.
 */
function cameraEvidence(camera: CameraObservation | null | undefined, mid: number, now: number) {
  const lead = mid - now;
  if (!camera?.usable || lead > CAMERA_EVIDENCE_HORIZON_MS) return { cloudWeight: 0, cloud: 0, auroraBoost: 0 };
  const hours = Math.max(0, lead) / HOUR;
  const seesSky = camera.skyVisible && camera.confidence >= 0.4 && camera.estimatedCloudCover !== undefined;
  return {
    cloudWeight: seesSky ? camera.confidence * Math.exp(-hours / 1.5) : 0,
    cloud: camera.estimatedCloudCover ?? 0,
    auroraBoost: camera.auroraVisible && camera.confidence >= 0.6 ? 0.85 * Math.exp(-hours / 0.75) : 0,
  };
}

/** Score every 30-minute slot of the night for one location (the location × time grid). */
export function evaluateSlots(params: {
  location: ViewingLocation;
  hourly: HourlyWeather[];
  slots: number[];
  activity: ActivityInputs;
  now: number;
  camera?: CameraObservation | null;
}): SlotEvaluation[] {
  const { location, hourly, slots, activity, now, camera } = params;
  const point = { lat: location.latitude, lon: location.longitude };
  const out: SlotEvaluation[] = [];

  for (const slot of slots) {
    const mid = slot + SLOT_MS / 2;
    const w = interpolateWeather(hourly, mid);
    if (!w) continue;

    const sunAlt = sunAltitude(mid, point);
    const moon = moonState(mid, point);
    const clouds = { total: w.cloudTotal, low: w.cloudLow, middle: w.cloudMid, high: w.cloudHigh };
    const leadHours = Math.max(0, mid - now) / HOUR;
    const expected = activityAt(mid, activity);
    const mlt = magneticLocalTime(utcHourOfDay(mid), location.magneticMidnightUtc);
    const sky = {
      sunAltitudeDeg: sunAlt,
      moon: { altitudeDeg: moon.altitude, azimuthDeg: moon.azimuth, illumination: moon.illumination },
      lightPollutionScore: location.lightPollutionScore,
      highCloud: clouds.high ?? 0,
    };
    const evidence = cameraEvidence(camera, mid, now);
    const weather = { precipitationMm: w.precipitationMm, visibilityKm: w.visibilityKm };

    const gates = kpScenarios(expected).map((kp) => {
      const v = auroraVisibility({ kp, mlt, cgmLatitude: location.cgmLatitude, sky });
      const forecastView = skyViewProbability({ clouds, ...weather, elevationDeg: v.geometry.elevationDeg, leadHours });
      const cameraView = skyViewProbability({ clouds: { total: evidence.cloud }, ...weather, elevationDeg: v.geometry.elevationDeg, leadHours: 0 });
      const view = evidence.cloudWeight * cameraView + (1 - evidence.cloudWeight) * forecastView;
      const aurora = 1 - (1 - v.probability) * (1 - evidence.auroraBoost);
      return { view, aurora, visibility: v };
    });

    const scenarios = gates.map((g) => g.view * g.aurora);
    const weighted = (pick: (g: (typeof gates)[number]) => number) => gates.reduce((s, g, k) => s + SCENARIO_WEIGHTS[k] * pick(g), 0);
    const chance = scenarios.reduce((s, p, k) => s + SCENARIO_WEIGHTS[k] * p, 0);
    const central = gates[Math.floor(gates.length / 2)].visibility;

    out.push({
      time: slot,
      chance,
      score: Math.round(100 * chance),
      scenarios,
      components: {
        skyView: Math.round(100 * weighted((g) => g.view)),
        aurora: Math.round(100 * weighted((g) => g.aurora)),
        kp: Math.round(expected.mean * 10) / 10,
        oval: {
          position: central.geometry.position,
          distanceDeg: Math.round(central.geometry.ovalDistanceDeg * 10) / 10,
          elevationDeg: Math.round(central.geometry.elevationDeg),
        },
        thresholdKr: Math.round(central.thresholdKr * 10) / 10,
        brightSky: central.brightSky,
        camera: evidence.cloudWeight > 0 ? Math.round(100 * (1 - evidence.cloud)) : null,
      },
      conditions: {
        time: new Date(slot).toISOString(),
        clouds: { ...clouds, effective: opaqueCloud(clouds) },
        kp: Math.round(expected.mean * 10) / 10,
        kpSource: expected.source,
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
  /** 0–100 chance of seeing aurora during the window. */
  viewingScore: number;
  /** Window chance under each activity scenario (0–1), for forecast confidence. */
  scenarioChances: number[];
  /** Best half-hour chance in the window, 0–100. */
  peakScore: number;
  /** Best half hour of the whole night, ignoring travel time. */
  nightPeak: { time: number; score: number } | null;
  departure: { departure: number; leaveNow: boolean; bufferMinutes: number } | null;
};

/** Apply travel time: drop slots the user cannot reach, then find the best window and departure. */
export function planVisit(evaluations: SlotEvaluation[], now: number, driveMinutes: number): VisitPlan {
  const earliestViewing = earliestViewingTime(now, driveMinutes);
  const reachable = evaluations.map((e) => isReachable(e.time, earliestViewing));
  const window = findBestWindow(
    evaluations.map((e, i) => ({ time: e.time, chance: e.chance, scenarios: e.scenarios, reachable: reachable[i] })),
    SCENARIO_WEIGHTS,
  );
  const nightPeak = evaluations.reduce<{ time: number; score: number } | null>(
    (best, e) => (best === null || e.score > best.score ? { time: e.time, score: e.score } : best),
    null,
  );

  if (!window) {
    return { earliestViewing, reachable, window, windowStart: null, windowEnd: null, viewingScore: 0, scenarioChances: [], peakScore: 0, nightPeak, departure: null };
  }
  const inWindow = evaluations.slice(window.startIndex, window.endIndex + 1);
  const windowStart = Math.max(evaluations[window.startIndex].time, roundUpToFiveMinutes(earliestViewing));
  const windowEnd = evaluations[window.endIndex].time + SLOT_MS;
  return {
    earliestViewing,
    reachable,
    window,
    windowStart,
    windowEnd,
    viewingScore: Math.round(100 * window.chance),
    scenarioChances: SCENARIO_WEIGHTS.map((_, k) => sessionChance(inWindow, SCENARIO_WEIGHTS.map((_, j) => (j === k ? 1 : 0)))),
    peakScore: Math.round(100 * window.peakChance),
    nightPeak,
    departure: computeDeparture({ windowStart, now, driveMinutes }),
  };
}

/**
 * Strongest gust (km/h) forecast at the destination while you are there: the raw hourly values from just
 * before the window until an hour after it ends (interpolated half-hour samples would shave off peaks).
 */
export function windowGustKph(hourly: HourlyWeather[], plan: Pick<VisitPlan, "windowStart" | "windowEnd">): number | undefined {
  const { windowStart, windowEnd } = plan;
  if (windowStart === null || windowEnd === null) return undefined;
  const gusts = hourly.flatMap((h) => (h.gustKph !== undefined && h.time >= windowStart - 30 * MINUTE && h.time <= windowEnd + HOUR ? [h.gustKph] : []));
  return gusts.length > 0 ? Math.max(...gusts) : undefined;
}
