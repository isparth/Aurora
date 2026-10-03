/**
 * Calibration check for the aurora model (`npm run calibrate`; needs network once, ~17 MB).
 *
 * Replays 25 dark seasons (1973–1997) of the observed GFZ Kp record (CC BY 4.0, Matzka et al. 2021) through
 * the production model at Finnish and Norwegian all-sky-camera stations, assuming clear skies, and compares
 * the share of dark nights with visible aurora with the Finnish Meteorological Institute's published
 * statistics: Helsinki about one night a month, Oulu–Kuusamo every fourth clear night, Sodankylä every
 * second, Kilpisjärvi three in four, and nearly every clear night on the Arctic coast. CGM latitudes and
 * magnetic midnights are for 1985, the middle of the period.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getMoonIllumination, getMoonPosition, getPosition } from "suncalc";
import { describe, expect, it } from "vitest";

import { auroraVisibility, magneticLocalTime } from "@/lib/scoring/aurora-visibility";
import { sessionChance } from "@/lib/scoring/chance";

const KP_URL = "https://kp.gfz.de/app/files/Kp_ap_since_1932.txt";
const KP_FILE = join(tmpdir(), "Kp_ap_since_1932.txt");
const HOUR = 3_600_000;
const SLOT = HOUR / 2;
const NIGHT_STEP_DAYS = 3;

const STATIONS = [
  { name: "Helsinki", lat: 60.17, lon: 24.94, cgm: 56.31, midnightUtc: 21.28, fmi: 0.04, tolerance: 0.06 },
  { name: "Oulu", lat: 65.01, lon: 25.47, cgm: 61.3, midnightUtc: 21.1, fmi: 0.25, tolerance: 0.12 },
  { name: "Kuusamo", lat: 65.97, lon: 29.19, cgm: 62.09, midnightUtc: 20.86, fmi: 0.25, tolerance: 0.12 },
  { name: "Sodankylä", lat: 67.37, lon: 26.63, cgm: 63.63, midnightUtc: 20.94, fmi: 0.5, tolerance: 0.12 },
  { name: "Kilpisjärvi", lat: 69.02, lon: 20.79, cgm: 65.64, midnightUtc: 21.16, fmi: 0.75, tolerance: 0.12 },
  { name: "Hammerfest", lat: 70.66, lon: 23.68, cgm: 67.1, midnightUtc: 20.92, fmi: 0.95, tolerance: 0.15 },
] as const;

async function loadKp(): Promise<Map<number, number>> {
  if (!existsSync(KP_FILE)) writeFileSync(KP_FILE, await (await fetch(KP_URL)).text());
  const kp = new Map<number, number>();
  for (const line of readFileSync(KP_FILE, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const f = line.trim().split(/\s+/);
    const year = Number(f[0]);
    if (year < 1972 || year > 1998) continue;
    kp.set(Date.UTC(year, Number(f[1]) - 1, Number(f[2]), Number(f[3])), Number(f[7]));
  }
  return kp;
}

/** Share of dark (Sun below −10°) nights with visible aurora, if every night were clear. */
function simulate(station: (typeof STATIONS)[number], kp: Map<number, number>): number {
  let total = 0;
  let nights = 0;
  for (let year = 1973; year <= 1997; year++) {
    for (let day = Date.UTC(year, 7, 20); day < Date.UTC(year + 1, 3, 20); day += NIGHT_STEP_DAYS * 24 * HOUR) {
      const slots: { scenarios: number[] }[] = [];
      for (let t = day + 12 * HOUR; t < day + 36 * HOUR; t += SLOT) {
        const mid = t + SLOT / 2;
        const date = new Date(mid);
        const sunAltitudeDeg = getPosition(date, station.lat, station.lon).altitude;
        const k = kp.get(Math.floor(mid / (3 * HOUR)) * 3 * HOUR);
        if (sunAltitudeDeg >= -10 || k === undefined) continue;
        const moon = getMoonPosition(date, station.lat, station.lon);
        const utcHour = (mid % (24 * HOUR)) / HOUR;
        const { probability } = auroraVisibility({
          kp: k,
          mlt: magneticLocalTime(utcHour, station.midnightUtc),
          cgmLatitude: station.cgm,
          sky: {
            sunAltitudeDeg,
            moon: { altitudeDeg: moon.altitude, azimuthDeg: moon.azimuth, illumination: getMoonIllumination(date).fraction },
            lightPollutionScore: 1,
            highCloud: 0,
          },
        });
        slots.push({ scenarios: [probability] });
      }
      if (slots.length === 0) continue;
      total += sessionChance(slots, [1]);
      nights++;
    }
  }
  return total / nights;
}

describe("aurora model calibration against FMI all-sky-camera statistics", () => {
  it("reproduces the share of clear dark nights with aurora from 56° to 67° geomagnetic latitude", async () => {
    const kp = await loadKp();
    const rows = STATIONS.map((s) => ({ station: s, model: simulate(s, kp) }));
    console.table(rows.map(({ station, model }) => ({ station: station.name, cgm: station.cgm, model: Math.round(100 * model), fmi: Math.round(100 * station.fmi) })));
    for (const { station, model } of rows) expect(Math.abs(model - station.fmi), station.name).toBeLessThanOrEqual(station.tolerance);
    for (let i = 1; i < rows.length; i++) expect(rows[i].model).toBeGreaterThan(rows[i - 1].model);
  });
});
