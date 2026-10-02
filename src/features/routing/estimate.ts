import type { RoutingProvider } from "@/domain/providers";
import type { Coordinates, Route } from "@/domain/types";
import { haversineKm } from "@/lib/geo";

/** Icelandic roads wind around fjords and lava fields; straight-line distance underestimates badly. */
export const ROAD_DETOUR_FACTOR = 1.35;
/** Deliberately conservative average speed for winter night driving. */
export const ESTIMATE_SPEED_KPH = 65;
const OVERHEAD_MINUTES = 5;

export function estimateRoute(origin: Coordinates, destination: Coordinates): Route {
  const distanceKm = haversineKm(origin, destination) * ROAD_DETOUR_FACTOR;
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMinutes: Math.round((distanceKm / ESTIMATE_SPEED_KPH) * 60 + OVERHEAD_MINUTES),
    source: "estimate",
    estimated: true,
  };
}

export const estimateRoutingProvider: RoutingProvider = {
  name: "estimate",
  route: async (origin, destination) => estimateRoute(origin, destination),
};
