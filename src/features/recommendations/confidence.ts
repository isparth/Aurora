import type { Confidence } from "@/domain/types";

export type ConfidenceInputs = {
  /** Hours from now until the start of the viewing window. */
  hoursAhead: number;
  auroraAvailable: boolean;
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

/**
 * Forecast confidence, kept separate from the score. Long horizons, missing aurora data,
 * fast-changing or broken cloud, and camera disagreement all reduce it.
 */
export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  let c = 1;
  c -= Math.min(0.35, Math.max(0, (inputs.hoursAhead - 2) * 0.04));
  if (!inputs.auroraAvailable) c -= 0.25;
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
  if (c >= 0.75) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}
