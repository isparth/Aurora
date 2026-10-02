import { z } from "zod";

import { TOWNS } from "@/data/towns";
import { VIEWING_LOCATIONS } from "@/data/viewing-locations";
import { cached } from "@/lib/cache";
import { haversineKm, ICELAND_BOUNDS } from "@/lib/geo";
import { fetchJson } from "@/lib/http";
import { HOUR } from "@/lib/time";

export type PlaceSuggestion = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
  kind: "town" | "place" | "spot";
};

const PHOTON_URL = process.env.PHOTON_BASE_URL || "https://photon.komoot.io";
const MAX_RESULTS = 8;

/** "Þingvellir" → "thingvellir", "Höfn" → "hofn", so people can type without Icelandic letters. */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/þ/g, "th")
    .replace(/ð/g, "d")
    .replace(/æ/g, "ae")
    .replace(/ö/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchRank(name: string, q: string): number {
  const n = normaliseName(name);
  if (n.startsWith(q)) return 0;
  if (n.split(" ").some((w) => w.startsWith(q))) return 1;
  if (n.includes(q)) return 2;
  return -1;
}

export function searchLocal(query: string): PlaceSuggestion[] {
  const q = normaliseName(query);
  if (!q) return [];
  const towns = TOWNS.map((t) => ({ s: { id: `town:${normaliseName(t.name)}`, name: t.name, detail: t.region, lat: t.lat, lon: t.lon, kind: "town" as const }, r: matchRank(t.name, q) }));
  const spots = VIEWING_LOCATIONS.map((l) => ({ s: { id: `spot:${l.id}`, name: l.name, detail: `${l.region} · viewing spot`, lat: l.latitude, lon: l.longitude, kind: "spot" as const }, r: matchRank(l.name, q) }));
  return [...towns, ...spots]
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || (a.s.kind === "town" ? -1 : 1))
    .map((x) => x.s)
    .slice(0, MAX_RESULTS);
}

const photonSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z
        .object({
          osm_id: z.number().optional(),
          osm_type: z.string().optional(),
          name: z.string().optional(),
          street: z.string().optional(),
          housenumber: z.string().optional(),
          city: z.string().optional(),
          district: z.string().optional(),
          county: z.string().optional(),
          countrycode: z.string().optional(),
        })
        .passthrough(),
    }),
  ),
});

export async function searchPhoton(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim().slice(0, 80);
  const { minLon, minLat, maxLon, maxLat } = ICELAND_BOUNDS;
  const params = new URLSearchParams({ q, limit: "8", bbox: `${minLon},${minLat},${maxLon},${maxLat}` });
  return cached(`photon:${normaliseName(q)}`, 24 * HOUR, async () => {
    const parsed = photonSchema.parse(await fetchJson(`${PHOTON_URL}/api/?${params}`, { timeoutMs: 4000 }));
    return parsed.features.flatMap((f): PlaceSuggestion[] => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      if (p.countrycode && p.countrycode !== "IS") return [];
      const name = p.name ?? (p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ""}` : undefined);
      if (!name) return [];
      const detail = [p.city ?? p.district, p.county].filter((x, i, all) => x && x !== name && all.indexOf(x) === i).join(", ");
      return [{ id: `osm:${p.osm_type ?? "x"}${p.osm_id ?? `${lat},${lon}`}`, name, detail: detail || "Iceland", lat, lon, kind: "place" }];
    });
  });
}

/** Local towns and viewing spots first (instant, offline-safe), then OpenStreetMap places via Photon. */
export async function searchPlaces(query: string): Promise<{ results: PlaceSuggestion[]; remote: boolean }> {
  const local = searchLocal(query);
  let remote: PlaceSuggestion[] = [];
  let remoteOk = true;
  if (normaliseName(query).length >= 3) {
    try {
      remote = await searchPhoton(query);
    } catch {
      remoteOk = false;
    }
  }
  const merged = [...local];
  for (const r of remote) {
    const duplicate = merged.some((m) => normaliseName(m.name) === normaliseName(r.name) && haversineKm(m, r) < 3);
    if (!duplicate) merged.push(r);
  }
  return { results: merged.slice(0, MAX_RESULTS), remote: remoteOk };
}
