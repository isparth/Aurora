import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { AuroraProvider } from "@/domain/providers";
import type { AuroraForecast, AuroraNight } from "@/domain/types";
import { cached } from "@/lib/cache";
import { fetchText } from "@/lib/http";
import { HOUR, MINUTE } from "@/lib/time";

export const IMO_AURORA_URL = "https://xmlweather.vedur.is/aurora?op=xml&lang=en&type=index";

const optionalText = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || String(v).trim() === "" ? undefined : String(v).trim()));

const nightSchema = z.object({
  evening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity_forecast: optionalText,
  sun: z.object({ sunset: optionalText, darkness: optionalText, dawn: optionalText, sunrise: optionalText }).partial().optional(),
  moon: z.object({ schedule_description: optionalText }).partial().optional(),
});

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "night_data",
});

function parseActivity(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 9 ? n : null;
}

/** Normalise IMO's aurora XML into domain nights. Invalid nights are skipped, not fatal. */
export function parseImoAuroraXml(xml: string): AuroraNight[] {
  const doc = parser.parse(xml) as { aurora?: { night_data?: unknown[] } };
  const nights: AuroraNight[] = [];
  for (const raw of doc.aurora?.night_data ?? []) {
    const parsed = nightSchema.safeParse(raw);
    if (!parsed.success) continue;
    const n = parsed.data;
    nights.push({
      eveningDate: n.evening_date,
      activity: parseActivity(n.activity_forecast),
      sunset: n.sun?.sunset,
      darkness: n.sun?.darkness,
      dawn: n.sun?.dawn,
      sunrise: n.sun?.sunrise,
      moonDescription: n.moon?.schedule_description,
    });
  }
  return nights;
}

export const imoAuroraProvider: AuroraProvider = {
  getForecast: () =>
    cached<AuroraForecast>(
      "imo:aurora",
      15 * MINUTE,
      async () => {
        const nights = parseImoAuroraXml(await fetchText(IMO_AURORA_URL, { timeoutMs: 8000 }));
        if (nights.length === 0) throw new Error("IMO aurora forecast contained no nights");
        return { source: "imo", fetchedAt: new Date().toISOString(), nights };
      },
      { staleMs: 6 * HOUR },
    ),
};

/** Activity for the night that starts on `eveningDate`, or null if IMO has no value for it. */
export function activityForNight(forecast: AuroraForecast, eveningDate: string): number | null {
  return forecast.nights.find((n) => n.eveningDate === eveningDate)?.activity ?? null;
}
