import type { Coordinates, RoadSafety, RoadSegmentReport } from "@/domain/types";
import { bboxContains, bboxOf, pointToPolylineKm, samplePolyline, type BBox } from "@/lib/geo";

import { SEVERITY, worstStatus } from "./status";

export type RoadSegment = RoadSegmentReport & {
  lines: Coordinates[][];
  bbox: BBox;
  lengthKm: number;
};

export type RoadNetwork = { segments: RoadSegment[]; fetchedAt: string; source: RoadSafety["source"] };

const SAMPLE_STEP_KM = 0.5;
/** A route sample belongs to a segment if it lies within this distance of it. */
const MATCH_TOLERANCE_KM = 0.25;
const DESTINATION_RADIUS_KM = 1;
const DESTINATION_ONLY_RADIUS_KM = 3;

const intersects = (a: BBox, b: BBox) => a.minLat <= b.maxLat && a.maxLat >= b.minLat && a.minLon <= b.maxLon && a.maxLon >= b.minLon;
const expand = (b: BBox, km: number): BBox => {
  const dLat = km / 111.2;
  const dLon = km / (111.2 * Math.cos(((b.minLat + b.maxLat) / 2) * (Math.PI / 180)));
  return { minLat: b.minLat - dLat, maxLat: b.maxLat + dLat, minLon: b.minLon - dLon, maxLon: b.maxLon + dLon };
};

const distanceToSegment = (p: Coordinates, s: RoadSegment) => Math.min(...s.lines.map((line) => pointToPolylineKm(p, line)));

/**
 * Segments the route actually drives along. Each route sample (every 500 m) is assigned to its
 * nearest segment; a segment counts only if it collects at least two samples and covers a
 * meaningful share of its length, so roads that merely cross the route at a junction are ignored.
 */
export function segmentsAlongRoute(network: RoadNetwork, path: Coordinates[]): RoadSegment[] {
  const routeBox = bboxOf(path, 1);
  const candidates = network.segments
    .filter((s) => intersects(s.bbox, routeBox))
    .map((s) => ({ s, box: expand(s.bbox, MATCH_TOLERANCE_KM) }));
  const hits = new Map<string, number>();

  for (const p of samplePolyline(path, SAMPLE_STEP_KM)) {
    let best: { id: string; d: number } | null = null;
    for (const { s, box } of candidates) {
      if (!bboxContains(box, p)) continue;
      const d = distanceToSegment(p, s);
      if (d <= MATCH_TOLERANCE_KM && (!best || d < best.d)) best = { id: s.id, d };
    }
    if (best) hits.set(best.id, (hits.get(best.id) ?? 0) + 1);
  }

  return candidates
    .map(({ s }) => s)
    .filter((s) => {
      const h = hits.get(s.id) ?? 0;
      return h >= 2 && h * SAMPLE_STEP_KM >= Math.min(1.5, 0.4 * s.lengthKm);
    });
}

export function segmentsNear(network: RoadNetwork, p: Coordinates, radiusKm: number): RoadSegment[] {
  const box = bboxOf([p], radiusKm);
  return network.segments.filter((s) => intersects(s.bbox, box) && distanceToSegment(p, s) <= radiusKm);
}

function describe(worst: RoadSegment[], coverage: RoadSafety["coverage"]): string {
  const [first] = worst;
  if (first.status === "good") return coverage === "route" ? "Easily passable along the route" : "Easily passable near the destination";
  const others = worst.length - 1;
  const base = `${first.description} on ${first.name}`;
  return others > 0 ? `${base} and ${others} other section${others > 1 ? "s" : ""}` : base;
}

/** Road safety for one drive: worst reported condition on the route (or near the destination). */
export function assessRoad(network: RoadNetwork, destination: Coordinates, path: Coordinates[] | null): RoadSafety {
  const coverage: RoadSafety["coverage"] = path && path.length >= 2 ? "route" : "destination";
  const matched =
    coverage === "route"
      ? [...new Set([...segmentsAlongRoute(network, path!), ...segmentsNear(network, destination, DESTINATION_RADIUS_KM)])]
      : segmentsNear(network, destination, DESTINATION_ONLY_RADIUS_KM);
  const known = matched.filter((s) => s.status !== "unknown");

  if (known.length === 0) {
    return {
      status: "unknown",
      description: "No official road-condition reports cover this drive",
      segments: [],
      coverage: "none",
      source: network.source,
      fetchedAt: network.fetchedAt,
    };
  }

  const status = worstStatus(known.map((s) => s.status));
  const sorted = [...known].sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);
  const worst = sorted.filter((s) => s.status === status);
  return {
    status,
    description: describe(worst, coverage),
    segments: sorted.slice(0, 6).map(({ id, name, status: st, description, updatedAt }) => ({ id, name, status: st, description, updatedAt })),
    coverage,
    source: network.source,
    fetchedAt: network.fetchedAt,
  };
}
