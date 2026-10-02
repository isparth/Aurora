import type { Coordinates } from "@/domain/types";
import { findSunCrossing, sunAltitude } from "@/lib/astronomy/darkness";
import { SLOT_MS } from "@/lib/scoring/windows";
import { HOUR, icelandDate, MINUTE } from "@/lib/time";

/** Below civil twilight the brightest aurora can start to show. */
export const NIGHT_SUN_ALTITUDE = -6;
/** "Dark skies" in the UI = end of nautical twilight. */
export const DARK_SKY_ALTITUDE = -12;
/** Near the December solstice the far north stays below −6° for ~20 hours. */
const MAX_NIGHT_MS = 24 * HOUR;
const SEARCH_HORIZON_MS = 30 * HOUR;
const MIN_REMAINING_MS = 60 * MINUTE;

export type Night = {
  /** Start of each 30-minute slot in the night, epoch ms. */
  slots: number[];
  start: number;
  end: number;
  /** Iceland date of the evening the night began (the key IMO uses for its forecast). */
  eveningDate: string;
  darkFrom: number | null;
  darkUntil: number | null;
};

/**
 * Tonight's dark period at the origin. If the current night is almost over, use the next one.
 * Returns null when there is no darkness within the next 30 hours (Icelandic summer).
 */
export function computeNight(p: Coordinates, now: number): Night | null {
  const first = Math.floor(now / SLOT_MS) * SLOT_MS;
  const isDark = (t: number) => sunAltitude(t + SLOT_MS / 2, p) < NIGHT_SUN_ALTITUDE;
  const findStart = (from: number) => {
    for (let t = from; t < first + SEARCH_HORIZON_MS; t += SLOT_MS) if (isDark(t)) return t;
    return null;
  };
  const findEnd = (from: number) => {
    let t = from;
    while (t < from + MAX_NIGHT_MS && isDark(t)) t += SLOT_MS;
    return t;
  };

  let start = findStart(first);
  if (start === null) return null;
  let end = findEnd(start);
  if (start === first && end - now < MIN_REMAINING_MS) {
    start = findStart(end);
    if (start === null) return null;
    end = findEnd(start);
  }

  const slots: number[] = [];
  for (let t = start; t < end; t += SLOT_MS) slots.push(t);

  const alreadyDark = start === first && sunAltitude(now, p) < DARK_SKY_ALTITUDE;
  const darkFrom = alreadyDark ? null : findSunCrossing(Math.max(now, start - 2 * HOUR), end, p, DARK_SKY_ALTITUDE, "below");
  const darkUntil =
    alreadyDark || darkFrom !== null
      ? findSunCrossing(alreadyDark ? now : (darkFrom as number), end + 2 * HOUR, p, DARK_SKY_ALTITUDE, "above")
      : null;

  return { slots, start, end, eveningDate: icelandDate(start - 12 * HOUR), darkFrom, darkUntil };
}
