import { z } from "zod";

import type { SpaceWeatherProvider } from "@/domain/providers";
import type { KpPoint, SpaceWeather } from "@/domain/types";
import { cached } from "@/lib/cache";
import { fetchJson } from "@/lib/http";
import { HOUR, MINUTE } from "@/lib/time";

/** NOAA SWPC public JSON products (public domain, no key). The forecast changed to an object format in March 2026. */
export const NOAA_KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
export const NOAA_KP_1M_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

const kpValue = z.union([z.number(), z.string().trim().regex(/^\d+(\.\d+)?$/).transform(Number)]).pipe(z.number().min(0).max(9));
const forecastEntry = z.object({ time_tag: z.string(), kp: kpValue, observed: z.enum(["observed", "estimated", "predicted"]) });
const oneMinuteEntry = z.object({ time_tag: z.string(), estimated_kp: kpValue });

/** NOAA time tags have no zone designator; they are UTC. */
function parseTimeTag(tag: string): number | null {
  const t = Date.parse(/(Z|[+-]\d\d:\d\d)$/.test(tag) ? tag : `${tag}Z`);
  return Number.isFinite(t) ? t : null;
}

/** 3-hour planetary Kp: observations, the current estimate and the forecast. Invalid entries are skipped. */
export function parseKpForecast(raw: unknown): KpPoint[] {
  const blocks: KpPoint[] = [];
  for (const entry of z.array(z.unknown()).parse(raw)) {
    const parsed = forecastEntry.safeParse(entry);
    if (!parsed.success) continue;
    const time = parseTimeTag(parsed.data.time_tag);
    if (time !== null) blocks.push({ time, kp: parsed.data.kp, kind: parsed.data.observed });
  }
  return blocks.sort((a, b) => a.time - b.time);
}

const NOWCAST_SPAN_MS = 30 * MINUTE;

/** Real-time activity: the mean of the 1-minute estimated Kp over the last half hour of the series. */
export function parseKpNowcast(raw: unknown): SpaceWeather["nowcast"] {
  const samples: { time: number; kp: number }[] = [];
  for (const entry of z.array(z.unknown()).parse(raw)) {
    const parsed = oneMinuteEntry.safeParse(entry);
    const time = parsed.success ? parseTimeTag(parsed.data.time_tag) : null;
    if (parsed.success && time !== null) samples.push({ time, kp: parsed.data.estimated_kp });
  }
  if (samples.length === 0) return null;
  const latest = Math.max(...samples.map((s) => s.time));
  const recent = samples.filter((s) => s.time >= latest - NOWCAST_SPAN_MS);
  return { time: latest, kp: recent.reduce((sum, s) => sum + s.kp, 0) / recent.length };
}

export const noaaSpaceWeatherProvider: SpaceWeatherProvider = {
  getSpaceWeather: () =>
    cached<SpaceWeather>(
      "noaa:kp",
      10 * MINUTE,
      async () => {
        const [forecast, oneMinute] = await Promise.allSettled([
          fetchJson(NOAA_KP_FORECAST_URL, { timeoutMs: 8000 }).then(parseKpForecast),
          fetchJson(NOAA_KP_1M_URL, { timeoutMs: 8000 }).then(parseKpNowcast),
        ]);
        const kp = forecast.status === "fulfilled" ? forecast.value : [];
        const nowcast = oneMinute.status === "fulfilled" ? oneMinute.value : null;
        if (kp.length === 0 && nowcast === null) {
          throw forecast.status === "rejected" ? forecast.reason : new Error("NOAA returned no Kp data");
        }
        return { source: "noaa", fetchedAt: new Date().toISOString(), kp, nowcast };
      },
      { staleMs: 3 * HOUR },
    ),
};
