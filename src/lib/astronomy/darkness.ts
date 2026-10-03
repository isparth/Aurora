import { getMoonIllumination, getMoonPosition, getMoonTimes, getPosition } from "suncalc";

import type { Coordinates } from "@/domain/types";

export function sunAltitude(time: number, p: Coordinates): number {
  return getPosition(new Date(time), p.lat, p.lon).altitude;
}

/** Moon illumination (0–1) and position (degrees; azimuth clockwise from north). */
export function moonState(time: number, p: Coordinates): { illumination: number; altitude: number; azimuth: number } {
  const date = new Date(time);
  const position = getMoonPosition(date, p.lat, p.lon);
  return { illumination: getMoonIllumination(date).fraction, altitude: position.altitude, azimuth: position.azimuth };
}

export function darknessLabel(sunAlt: number): string {
  if (sunAlt >= 0) return "Daylight";
  if (sunAlt >= -6) return "Civil twilight";
  if (sunAlt >= -12) return "Nautical twilight";
  if (sunAlt >= -18) return "Astronomical twilight";
  return "Fully dark";
}

/** First time in [from, to) at which the sun is below (or above) `thresholdDeg`, scanning in 5-minute steps. */
export function findSunCrossing(
  from: number,
  to: number,
  p: Coordinates,
  thresholdDeg: number,
  direction: "below" | "above",
): number | null {
  const step = 5 * 60_000;
  for (let t = from; t < to; t += step) {
    const alt = sunAltitude(t, p);
    if (direction === "below" ? alt < thresholdDeg : alt >= thresholdDeg) return t;
  }
  return null;
}

const PHASES = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
];

export function moonPhaseName(time: number): string {
  const { phase } = getMoonIllumination(new Date(time));
  return PHASES[Math.round(phase * 8) % 8];
}

/** Moonrise / moonset events falling inside [from, to]. */
export function moonEvents(from: number, to: number, p: Coordinates): { rise: number | null; set: number | null } {
  let rise: number | null = null;
  let set: number | null = null;
  const dayMs = 86_400_000;
  for (let day = Math.floor(from / dayMs) * dayMs; day <= to; day += dayMs) {
    const times = getMoonTimes(new Date(day), p.lat, p.lon);
    const r = times.rise?.getTime();
    const s = times.set?.getTime();
    if (rise === null && r !== undefined && r >= from && r <= to) rise = r;
    if (set === null && s !== undefined && s >= from && s <= to) set = s;
  }
  return { rise, set };
}
