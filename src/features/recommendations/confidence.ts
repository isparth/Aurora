import type { ActivitySource, Confidence } from "@/domain/types";

export type ConfidenceInputs = {
  /** Hours from now until the start of the viewing window. */
  hoursAhead: number;
  /** Best source behind the activity estimate during the window. */
  activitySource: ActivitySource;
  /** Window chance (0–1) under each activity scenario, with the scenario weights. */
  scenarioChances: number[];
  scenarioWeights: readonly number[];
  /** Effective cloud cover (0–1) for the window and its neighbouring slots. */
  windowClouds: number[];
  /** Camera-estimated vs forecast cloud cover, when a camera was analysed. */
  camera?: { observedCloud: number; forecastCloud: number } | null;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const SOURCE_PENALTY: Record<ActivitySource, number> = { nowcast: 0, forecast: 0.05, imo: 0.1, typical: 0.35 };

/**
 * Forecast confidence, kept separate from the chance. Long horizons, weak or missing activity data, a
 * chance that swings with the activity scenario, fast-changing or broken cloud and camera disagreement all
 * reduce it. More than four hours ahead it is never "high": the model itself is only good to roughly ±10–15
 * points, whatever the inputs say.
 */
export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  let c = 1;
  c -= Math.min(0.35, Math.max(0, (inputs.hoursAhead - 2) * 0.04));
  c -= SOURCE_PENALTY[inputs.activitySource];
  if (inputs.scenarioChances.length === inputs.scenarioWeights.length && inputs.scenarioChances.length > 0) {
    const m = inputs.scenarioChances.reduce((s, p, k) => s + inputs.scenarioWeights[k] * p, 0);
    const spread = Math.sqrt(inputs.scenarioChances.reduce((s, p, k) => s + inputs.scenarioWeights[k] * (p - m) ** 2, 0));
    c -= Math.min(0.25, 0.8 * spread);
  }
  if (inputs.windowClouds.length > 0) {
    c -= Math.min(0.25, stdDev(inputs.windowClouds));
    const m = mean(inputs.windowClouds);
    if (m > 0.3 && m < 0.7) c -= 0.1;
  }
  if (inputs.camera) {
    const gap = Math.abs(inputs.camera.observedCloud - inputs.camera.forecastCloud);
    if (gap <= 0.25) c += 0.1;
    else if (gap >= 0.5) c -= 0.15;
  }
  if (c >= 0.8 && inputs.hoursAhead <= 4) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}
