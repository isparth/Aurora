import { z } from "zod";

import type { RoutingProvider } from "@/domain/providers";
import type { Coordinates, Route } from "@/domain/types";
import { cached } from "@/lib/cache";
import { thinLine } from "@/lib/geo";
import { fetchJson } from "@/lib/http";
import { createRateBudget } from "@/lib/rate-budget";
import { HOUR } from "@/lib/time";

import { estimateRoutingProvider } from "./estimate";

const PUBLIC_OSRM = "https://router.project-osrm.org";
const ROUTE_TTL = 12 * HOUR;
const MAX_GEOMETRY_POINTS = 600;

const routeResponse = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
      }),
    )
    .optional(),
});

/** Origins are rounded to ~1 km so nearby users share cached routes. */
const routeKey = (provider: string, o: Coordinates, d: Coordinates) =>
  `route:${provider}:${o.lat.toFixed(2)},${o.lon.toFixed(2)}>${d.lat.toFixed(4)},${d.lon.toFixed(4)}`;

function toRoute(raw: unknown, source: "osrm" | "mapbox"): Route {
  const parsed = routeResponse.parse(raw);
  const route = parsed.routes?.[0];
  if (parsed.code !== "Ok" || !route) throw new Error(`${source} returned ${parsed.code}`);
  return {
    durationMinutes: Math.round(route.duration / 60),
    distanceKm: Math.round(route.distance / 100) / 10,
    geometry: thinLine(route.geometry.coordinates, MAX_GEOMETRY_POINTS),
    source,
    estimated: false,
  };
}

export function createOsrmProvider(baseUrl: string): RoutingProvider & { maxConcurrency: number } {
  const base = baseUrl.replace(/\/$/, "");
  const isPublic = base === PUBLIC_OSRM;
  // The public demo server asks for at most one request per second; self-hosted can go faster.
  const spend = createRateBudget("osrm", isPublic ? 50 : 600);
  return {
    name: "osrm",
    maxConcurrency: isPublic ? 1 : 4,
    route: (o, d) =>
      cached(routeKey("osrm", o, d), ROUTE_TTL, async () => {
        spend();
        return toRoute(
          await fetchJson(`${base}/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`, {
            timeoutMs: 6000,
          }),
          "osrm",
        );
      }),
  };
}

export function createMapboxProvider(token: string, maxPerMinute = 120): RoutingProvider & { maxConcurrency: number } {
  const spend = createRateBudget("mapbox", maxPerMinute);
  return {
    name: "mapbox",
    maxConcurrency: 4,
    route: (o, d) =>
      cached(routeKey("mapbox", o, d), ROUTE_TTL, async () => {
        spend();
        const params = new URLSearchParams({ geometries: "geojson", overview: "full", access_token: token });
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${o.lon},${o.lat};${d.lon},${d.lat}?${params}`;
        return toRoute(await fetchJson(url, { timeoutMs: 6000 }), "mapbox");
      }),
  };
}

/**
 * ROUTING_PROVIDER=mapbox|osrm|estimate. Defaults to Mapbox when MAPBOX_TOKEN is set,
 * otherwise OSRM (public demo server unless OSRM_BASE_URL is given). Failures fall back to
 * a conservative distance-based estimate in the engine.
 */
export function selectRoutingProvider(env: NodeJS.ProcessEnv = process.env): RoutingProvider {
  const mode = env.ROUTING_PROVIDER?.trim().toLowerCase();
  const token = env.MAPBOX_TOKEN?.trim();
  if (mode === "estimate") return estimateRoutingProvider;
  if (mode === "mapbox" || (!mode && token)) {
    const limit = Number(env.ROUTING_MAX_PER_MINUTE);
    return token ? createMapboxProvider(token, Number.isFinite(limit) && limit > 0 ? limit : undefined) : estimateRoutingProvider;
  }
  return createOsrmProvider(env.OSRM_BASE_URL?.trim() || PUBLIC_OSRM);
}
