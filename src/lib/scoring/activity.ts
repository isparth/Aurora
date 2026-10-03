import type { ActivitySource, KpPoint } from "@/domain/types";

/**
 * Geomagnetic activity (Kp) for each half hour, with an honest uncertainty.
 *
 * Kp forecasts are weakly skilful: NOAA's own verification of next-day maximum Kp shows an RMS error of
 * about 1.3, a linear association of ~0.45 and a tendency to over-forecast. Forecast values are therefore
 * pulled part of the way towards a typical night, and a real-time estimate — far more reliable for the
 * next hour or two — takes over near the present.
 */
export type Activity = { mean: number; sigma: number; source: ActivitySource };
export type ActivityInputs = {
  now: number;
  /** Real-time estimated Kp and when it was measured (NOAA 1-minute index). */
  nowcast: { time: number; kp: number } | null;
  /** NOAA 3-hour Kp blocks (observed, estimated and predicted). */
  kpForecast: KpPoint[];
  /** IMO's Kp forecast for midnight tonight. */
  imoKp: number | null;
};

/** Night-time Kp in 2015–2025 (GFZ Kp record): what a night looks like with no forecast at all. */
export const KP_CLIMATOLOGY = { mean: 1.9, sd: 1.3 } as const;
/** Share of a forecast's departure from a typical night that is kept (≈ its correlation with what happens). */
export const FORECAST_SHRINK = 0.6;
export const FORECAST_SIGMA = { forecast: 1.2, imo: 1.3 } as const;
/** Spread around a real-time estimate, including the scatter of the oval's position at a given Kp. */
export const NOWCAST_SIGMA = 0.6;
/** How quickly the real-time estimate stops predicting the future, hours. */
export const NOWCAST_MEMORY_HOURS = 2;
/** A real-time estimate older than this is not used. */
export const NOWCAST_MAX_AGE_MS = 45 * 60_000;
const BLOCK_MS = 3 * 3_600_000;
const HOUR = 3_600_000;

const shrink = (kp: number) => KP_CLIMATOLOGY.mean + FORECAST_SHRINK * (kp - KP_CLIMATOLOGY.mean);

function forecastAt(time: number, inputs: ActivityInputs): Activity {
  const block = inputs.kpForecast.find((b) => time >= b.time && time < b.time + BLOCK_MS);
  if (block) {
    return block.kind === "observed"
      ? { mean: block.kp, sigma: NOWCAST_SIGMA, source: "forecast" }
      : { mean: shrink(block.kp), sigma: FORECAST_SIGMA.forecast, source: "forecast" };
  }
  if (inputs.imoKp !== null) return { mean: shrink(inputs.imoKp), sigma: FORECAST_SIGMA.imo, source: "imo" };
  return { mean: KP_CLIMATOLOGY.mean, sigma: KP_CLIMATOLOGY.sd, source: "typical" };
}

export function activityAt(time: number, inputs: ActivityInputs): Activity {
  const base = forecastAt(time, inputs);
  const nowcast = inputs.nowcast;
  if (!nowcast || inputs.now - nowcast.time > NOWCAST_MAX_AGE_MS) return base;
  const lead = Math.max(0, time - inputs.now) / HOUR;
  const memory = Math.exp(-lead / NOWCAST_MEMORY_HOURS);
  return {
    mean: memory * nowcast.kp + (1 - memory) * base.mean,
    sigma: NOWCAST_SIGMA + (base.sigma - NOWCAST_SIGMA) * (1 - Math.exp(-lead / 3)),
    source: memory >= 0.5 ? "nowcast" : base.source,
  };
}

/** Five-point Gauss–Hermite rule: activity scenarios shared by every half hour of the night. */
export const KP_SCENARIOS = [
  { z: -2.8569700139, weight: 0.0112574113 },
  { z: -1.35562618, weight: 0.222075922 },
  { z: 0, weight: 8 / 15 },
  { z: 1.35562618, weight: 0.222075922 },
  { z: 2.8569700139, weight: 0.0112574113 },
] as const;
export const SCENARIO_WEIGHTS = KP_SCENARIOS.map((s) => s.weight);

export function kpScenarios(a: Activity): number[] {
  return KP_SCENARIOS.map(({ z }) => Math.min(9, Math.max(0, a.mean + z * a.sigma)));
}
