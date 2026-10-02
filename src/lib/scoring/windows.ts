export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60_000;

export type ScoredSlot = { time: number; score: number; reachable: boolean };

export type ViewingWindow = {
  startIndex: number;
  endIndex: number;
  peakIndex: number;
  averageScore: number;
  peakScore: number;
};

/**
 * Best contiguous viewing period among reachable slots.
 * Slots qualify when they stay within ~10 points (or 15%) of the reachable peak; among the
 * qualifying runs, the one with the largest total score wins, so a long, steady clear spell
 * beats a single brief spike.
 */
export function findBestWindow(slots: ScoredSlot[]): ViewingWindow | null {
  let peak = -1;
  for (const s of slots) if (s.reachable) peak = Math.max(peak, s.score);
  if (peak <= 0) return null;

  const threshold = Math.max(peak - 10, peak * 0.85);
  let best: ViewingWindow | null = null;
  let bestTotal = -1;

  let i = 0;
  while (i < slots.length) {
    if (!slots[i].reachable || slots[i].score < threshold) {
      i++;
      continue;
    }
    let j = i;
    let total = 0;
    let peakIndex = i;
    // A run only continues through consecutive slots: a gap in the data ends the window.
    while (j < slots.length && slots[j].reachable && slots[j].score >= threshold && (j === i || slots[j].time - slots[j - 1].time === SLOT_MS)) {
      total += slots[j].score;
      if (slots[j].score > slots[peakIndex].score) peakIndex = j;
      j++;
    }
    if (total > bestTotal) {
      bestTotal = total;
      best = {
        startIndex: i,
        endIndex: j - 1,
        peakIndex,
        averageScore: total / (j - i),
        peakScore: slots[peakIndex].score,
      };
    }
    i = j;
  }
  return best;
}

export const PARKING_MINUTES = 5;

/** A slot is usable if you can be on site by its midpoint. */
export function isReachable(slotTime: number, earliestViewing: number): boolean {
  return slotTime + SLOT_MS / 2 >= earliestViewing;
}

export function earliestViewingTime(now: number, driveMinutes: number): number {
  return now + (driveMinutes + PARKING_MINUTES) * 60_000;
}

const FIVE_MIN = 5 * 60_000;

export function departureBufferMinutes(driveMinutes: number): number {
  return Math.max(10, Math.round(driveMinutes * 0.15));
}

/**
 * Leave at: start of viewing − drive − buffer, rounded down to 5 minutes.
 * If that is (nearly) now, the answer is simply "leave now".
 */
export function computeDeparture(params: { windowStart: number; now: number; driveMinutes: number }): {
  departure: number;
  leaveNow: boolean;
  bufferMinutes: number;
} {
  const bufferMinutes = departureBufferMinutes(params.driveMinutes);
  const raw = params.windowStart - (params.driveMinutes + bufferMinutes) * 60_000;
  const departure = Math.floor(raw / FIVE_MIN) * FIVE_MIN;
  if (departure <= params.now + FIVE_MIN) return { departure: params.now, leaveNow: true, bufferMinutes };
  return { departure, leaveNow: false, bufferMinutes };
}

export function roundUpToFiveMinutes(time: number): number {
  return Math.ceil(time / FIVE_MIN) * FIVE_MIN;
}
