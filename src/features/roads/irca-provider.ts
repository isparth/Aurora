import { z } from "zod";

import type { RoadConditionProvider } from "@/domain/providers";
import type { Coordinates } from "@/domain/types";
import { cached } from "@/lib/cache";
import { bboxOf, polylineLengthKm } from "@/lib/geo";
import { fetchJson } from "@/lib/http";
import { HOUR, MINUTE } from "@/lib/time";

import { assessRoad, type RoadNetwork, type RoadSegment } from "./route-matching";
import { normaliseRoadCondition } from "./status";

/** IRCA road conditions ("færð"), refreshed every few minutes upstream. */
export const IRCA_CONDITIONS_URL = "https://gagnaveita.vegagerdin.is/api/faerd2017_1";
/** Snow-clearing route geometry, joined on IDBUTUR. IRCA asks that it is not fetched many times a day. */
export const IRCA_GEOMETRY_URL =
  "https://gagnaveita.vegagerdin.is/geoserver/gis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=gis:faerdferlar2017_1&srsName=EPSG:4326&cql_filter=NAKVAEMNIFERLIS=1&outputFormat=application/json";

const text = z.string().nullable().optional();
const conditionsSchema = z.array(
  z.object({
    IdButur: z.number(),
    StuttNafnButs: text,
    FulltNafnButs: text,
    AstandYfirbord: text,
    AstandVidbotaruppl: text,
    AstandLysingEn: text,
    DagsSkrad: text,
  }),
);

const geometrySchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({ IDBUTUR: z.number() }),
      geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.array(z.number()).min(2)) }).nullable(),
    }),
  ),
});

type Geometry = Map<string, Coordinates[][]>;

export function parseGeometry(raw: unknown): Geometry {
  const lines: Geometry = new Map();
  for (const f of geometrySchema.parse(raw).features) {
    if (!f.geometry || f.geometry.coordinates.length < 2) continue;
    const id = String(f.properties.IDBUTUR);
    const line = f.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
    lines.set(id, [...(lines.get(id) ?? []), line]);
  }
  return lines;
}

export function buildNetwork(rawConditions: unknown, geometry: Geometry, fetchedAt: string): RoadNetwork {
  const segments: RoadSegment[] = [];
  for (const c of conditionsSchema.parse(rawConditions)) {
    const lines = geometry.get(String(c.IdButur));
    if (!lines) continue;
    segments.push({
      id: String(c.IdButur),
      name: c.FulltNafnButs || c.StuttNafnButs || `Section ${c.IdButur}`,
      status: normaliseRoadCondition(c.AstandYfirbord, c.AstandVidbotaruppl),
      description: c.AstandLysingEn || "Condition not described",
      updatedAt: c.DagsSkrad ?? undefined,
      lines,
      bbox: bboxOf(lines.flat()),
      lengthKm: lines.reduce((sum, l) => sum + polylineLengthKm(l), 0),
    });
  }
  return { segments, fetchedAt, source: "irca" };
}

const loadGeometry = () =>
  cached("irca:road-geometry", 24 * HOUR, async () => parseGeometry(await fetchJson(IRCA_GEOMETRY_URL, { timeoutMs: 15000 })), {
    staleMs: 7 * 24 * HOUR,
  });

export const loadRoadNetwork = () =>
  cached(
    "irca:road-network",
    5 * MINUTE,
    async () => {
      const [conditions, geometry] = await Promise.all([fetchJson(IRCA_CONDITIONS_URL, { timeoutMs: 10000 }), loadGeometry()]);
      const network = buildNetwork(conditions, geometry, new Date().toISOString());
      if (network.segments.length === 0) throw new Error("IRCA road data could not be joined to route geometry");
      return network;
    },
    { staleMs: 30 * MINUTE },
  );

export const ircaRoadProvider: RoadConditionProvider = {
  prefetch: async () => {
    await loadRoadNetwork();
  },
  assess: async (destination, path) => assessRoad(await loadRoadNetwork(), destination, path),
};
