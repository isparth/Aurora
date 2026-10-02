import { getMoonIllumination, getMoonPosition, getMoonTimes, getPosition } from "suncalc";

import type { Coordinates } from "@/domain/types";

export function sunAltitude(time: number, p: Coordinates): number {
  return getPosition(new Date(time), p.lat, p.lon).altitude;
}

export function moonState(time: number, p: Coordinates): { illumination: number; altitude: number } {
  const date = new Date(time);
  return {
    illumination: getMoonIllumination(date).fraction,
    altitude: getMoonPosition(date, p.lat, p.lon).altitude,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Sky darkness from the sun alone (0 = too bright, 1 = astronomical night).
 * Bright aurora shows from late civil twilight; nautical twilight is usually dark enough.
 */
export function sunDarkness(altitudeDeg: number): number {
  if (altitudeDeg >= -4) return 0;
  if (altitudeDeg >= -6) return lerp(0, 0.15, (-4 - altitudeDeg) / 2);
  if (altitudeDeg >= -12) return lerp(0.15, 0.75, (-6 - altitudeDeg) / 6);
  if (altitudeDeg >= -18) return lerp(0.75, 1, (-12 - altitudeDeg) / 6);
  return 1;
}

/** Moonlight only modestly brightens the sky: at most −30% with a full moon high in the sky. */
export function moonlightPenalty(illumination: number, moonAltitudeDeg: number): number {
  if (moonAltitudeDeg <= 0) return 0;
  return 0.3 * illumination * Math.sin((Math.min(moonAltitudeDeg, 90) * Math.PI) / 180);
}

export function combinedDarkness(sunAlt: number, moonIllumination: number, moonAlt: number): number {
  return sunDarkness(sunAlt) * (1 - moonlightPenalty(moonIllumination, moonAlt));
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
