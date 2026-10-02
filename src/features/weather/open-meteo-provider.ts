import { z } from "zod";

import type { WeatherProvider } from "@/domain/providers";
import type { Coordinates, HourlyWeather } from "@/domain/types";
import { readCache, writeCache } from "@/lib/cache";
import { chunk, mapWithConcurrency } from "@/lib/concurrency";
import { fetchJson } from "@/lib/http";
import { MINUTE } from "@/lib/time";

const BASE_URL = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com";
const HOURLY_FIELDS = [
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "temperature_2m",
  "precipitation",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
] as const;
const TTL = 15 * MINUTE;
const BATCH_SIZE = 10;

const series = z.array(z.number().nullable()).optional();
const locationSchema = z.object({
  hourly: z.object({
    time: z.array(z.number()),
    cloud_cover: z.array(z.number().nullable()),
    cloud_cover_low: series,
    cloud_cover_mid: series,
    cloud_cover_high: series,
    temperature_2m: series,
    precipitation: series,
    visibility: series,
    wind_speed_10m: series,
    wind_gusts_10m: series,
  }),
});

const pct = (v: number | null | undefined) => (v === null || v === undefined ? undefined : Math.min(1, Math.max(0, v / 100)));
const num = (v: number | null | undefined) => (v === null || v === undefined ? undefined : v);

/** Normalise one Open-Meteo location block (unixtime format) into domain hourly weather. */
export function normaliseOpenMeteoLocation(raw: unknown): HourlyWeather[] {
  const { hourly: h } = locationSchema.parse(raw);
  const out: HourlyWeather[] = [];
  h.time.forEach((time, i) => {
    const total = pct(h.cloud_cover[i]);
    if (total === undefined) return;
    const visibility = num(h.visibility?.[i]);
    out.push({
      time: time * 1000,
      cloudTotal: total,
      cloudLow: pct(h.cloud_cover_low?.[i]),
      cloudMid: pct(h.cloud_cover_mid?.[i]),
      cloudHigh: pct(h.cloud_cover_high?.[i]),
      temperatureC: num(h.temperature_2m?.[i]),
      precipitationMm: num(h.precipitation?.[i]),
      visibilityKm: visibility === undefined ? undefined : visibility / 1000,
      windKph: num(h.wind_speed_10m?.[i]),
      gustKph: num(h.wind_gusts_10m?.[i]),
    });
  });
  return out.sort((a, b) => a.time - b.time);
}

/** Open-Meteo returns an object for one coordinate and an array for several. */
export function normaliseOpenMeteoResponse(raw: unknown): HourlyWeather[][] {
  return (Array.isArray(raw) ? raw : [raw]).map(normaliseOpenMeteoLocation);
}

const keyFor = (p: Coordinates) => `open-meteo:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

function forecastUrl(points: Coordinates[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(","),
    longitude: points.map((p) => p.lon.toFixed(4)).join(","),
    hourly: HOURLY_FIELDS.join(","),
    forecast_days: "3",
    timeformat: "unixtime",
    timezone: "GMT",
  });
  return `${BASE_URL}/v1/forecast?${params}`;
}

async function getHourlyForecasts(points: Coordinates[]): Promise<(HourlyWeather[] | Error)[]> {
  const results: (HourlyWeather[] | Error | undefined)[] = points.map((p) => readCache<HourlyWeather[]>(keyFor(p)));
  const missing = points.map((p, i) => ({ p, i })).filter(({ i }) => results[i] === undefined);

  await mapWithConcurrency(chunk(missing, BATCH_SIZE), 3, async (batch) => {
    try {
      const forecasts = normaliseOpenMeteoResponse(await fetchJson(forecastUrl(batch.map((b) => b.p)), { timeoutMs: 10000 }));
      if (forecasts.length !== batch.length) throw new Error("Open-Meteo returned an unexpected number of locations");
      batch.forEach(({ p, i }, k) => {
        writeCache(keyFor(p), forecasts[k], TTL);
        results[i] = forecasts[k];
      });
    } catch (error) {
      for (const { p, i } of batch) {
        results[i] = readCache<HourlyWeather[]>(keyFor(p), { allowStale: true }) ?? (error instanceof Error ? error : new Error(String(error)));
      }
    }
  });

  return results.map((r) => r ?? new Error("No forecast"));
}

export const openMeteoProvider: WeatherProvider = {
  async getHourlyForecast(lat, lon) {
    const [result] = await getHourlyForecasts([{ lat, lon }]);
    if (result instanceof Error) throw result;
    return result;
  },
  getHourlyForecasts,
};
