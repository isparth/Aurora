import { SLOT_MS } from "./windows";

/**
 * From half-hour chances to "your chance tonight".
 *
 * Within one activity scenario, half hours are strongly correlated (an active night tends to stay active, a
 * cloud deck stays put). Calibration against FMI's statistics — the share of clear nights with aurora is
 * only a little higher than the share of clear hours at the best time of night — puts the weight of each
 * extra half hour at about 0.15 of an independent chance. Scenarios (forecast uncertainty) are averaged last.
 */
export const SESSION_CORRELATION = 0.15;
/** Below this best half-hour chance there is no window worth recommending. */
export const MIN_WINDOW_CHANCE = 0.03;
/** Recommended windows are at most five hours long. */
export const MAX_WINDOW_SLOTS = 10;

export type ScenarioSlot = { scenarios: readonly number[] };
export type ChanceSlot = ScenarioSlot & { time: number; chance: number; reachable: boolean };
export type ViewingWindow = { startIndex: number; endIndex: number; peakIndex: number; chance: number; peakChance: number };

const ALMOST_CERTAIN = 1 - 1e-9;

/** Chance of seeing aurora at least once during these half hours. */
export function sessionChance(slots: readonly ScenarioSlot[], weights: readonly number[]): number {
  if (slots.length === 0) return 0;
  let total = 0;
  weights.forEach((weight, k) => {
    let best = 0;
    let logMiss = 0;
    for (const slot of slots) {
      const p = Math.min(slot.scenarios[k], ALMOST_CERTAIN);
      logMiss += Math.log1p(-p);
      if (p > best) best = p;
    }
    const logMissOthers = logMiss - Math.log1p(-best);
    total += weight * (1 - (1 - best) * Math.exp(SESSION_CORRELATION * logMissOthers));
  });
  return total;
}

/**
 * Best viewing window among reachable half hours: runs of slots within reach of the night's best chance
 * (at least half of it, and no more than 25 points below), at most five hours long; the run with the highest
 * session chance wins, so a long steady spell beats a brief spike. A run never bridges a gap in the data.
 */
export function findBestWindow(slots: readonly ChanceSlot[], weights: readonly number[]): ViewingWindow | null {
  let peak = 0;
  for (const s of slots) if (s.reachable && s.chance > peak) peak = s.chance;
  if (peak < MIN_WINDOW_CHANCE) return null;
  const threshold = Math.max(0.5 * peak, peak - 0.25);
  const qualifies = (i: number) => slots[i].reachable && slots[i].chance >= threshold;

  let best: ViewingWindow | null = null;
  for (let i = 0; i < slots.length; ) {
    if (!qualifies(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < slots.length && qualifies(j + 1) && slots[j + 1].time - slots[j].time === SLOT_MS) j++;
    for (let a = i; a <= Math.max(i, j - MAX_WINDOW_SLOTS + 1); a++) {
      const b = Math.min(j, a + MAX_WINDOW_SLOTS - 1);
      const chance = sessionChance(slots.slice(a, b + 1), weights);
      if (best && chance <= best.chance) continue;
      let peakIndex = a;
      for (let k = a + 1; k <= b; k++) if (slots[k].chance > slots[peakIndex].chance) peakIndex = k;
      best = { startIndex: a, endIndex: b, peakIndex, chance, peakChance: slots[peakIndex].chance };
    }
    i = j + 1;
  }
  return best;
}
