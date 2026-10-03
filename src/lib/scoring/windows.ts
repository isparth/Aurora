export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60_000;

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
