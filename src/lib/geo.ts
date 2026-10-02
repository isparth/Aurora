import type { Coordinates } from "@/domain/types";

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Local equirectangular projection (km) — accurate enough for distances under ~50 km. */
function project(p: Coordinates, refLat: number): [number, number] {
  const kx = EARTH_RADIUS_KM * toRad(1) * Math.cos(toRad(refLat));
  const ky = EARTH_RADIUS_KM * toRad(1);
  return [p.lon * kx, p.lat * ky];
}

export function pointToSegmentKm(p: Coordinates, a: Coordinates, b: Coordinates): number {
  const refLat = p.lat;
  const [px, py] = project(p, refLat);
  const [ax, ay] = project(a, refLat);
  const [bx, by] = project(b, refLat);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function pointToPolylineKm(p: Coordinates, line: Coordinates[]): number {
  if (line.length === 1) return haversineKm(p, line[0]);
  let min = Infinity;
  for (let i = 1; i < line.length; i++) {
    min = Math.min(min, pointToSegmentKm(p, line[i - 1], line[i]));
  }
  return min;
}

export function polylineLengthKm(line: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineKm(line[i - 1], line[i]);
  return total;
}

/** Points spaced roughly every `stepKm` along the polyline, including both ends. */
export function samplePolyline(line: Coordinates[], stepKm: number): Coordinates[] {
  if (line.length === 0) return [];
  const out: Coordinates[] = [line[0]];
  let carried = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const segment = haversineKm(a, b);
    let pos = stepKm - carried;
    while (pos <= segment) {
      const t = pos / segment;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
      pos += stepKm;
    }
    carried = segment - (pos - stepKm);
  }
  const last = line[line.length - 1];
  const tail = out[out.length - 1];
  if (tail.lat !== last.lat || tail.lon !== last.lon) out.push(last);
  return out;
}

export type BBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export function bboxOf(points: Coordinates[], paddingKm = 0): BBox {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const dLat = paddingKm / 111.2;
  const dLon = paddingKm / (111.2 * Math.cos(toRad((minLat + maxLat) / 2)));
  return { minLat: minLat - dLat, maxLat: maxLat + dLat, minLon: minLon - dLon, maxLon: maxLon + dLon };
}

export function bboxContains(b: BBox, p: Coordinates): boolean {
  return p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon;
}

/** Reduce a [lon, lat] line to at most `maxPoints` by uniform striding (keeps endpoints). */
export function thinLine(line: [number, number][], maxPoints: number): [number, number][] {
  if (line.length <= maxPoints) return line;
  const stride = (line.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => line[Math.round(i * stride)]);
}

export const ICELAND_BOUNDS: BBox = { minLat: 63.2, maxLat: 66.7, minLon: -24.7, maxLon: -13.3 };
