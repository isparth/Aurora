import { nearestTown } from "@/data/towns";
import { VIEWING_LOCATIONS } from "@/data/viewing-locations";
import type { RoadConditionProvider } from "@/domain/providers";
import type { LocationDetail, Origin, RecommendationResponse, TravelMode } from "@/domain/types";
import { imoAuroraProvider } from "@/features/aurora/imo-provider";
import { estimateRoutingProvider } from "@/features/routing/estimate";
import { openMeteoProvider } from "@/features/weather/open-meteo-provider";

import { evaluateLocation, recommend, type EngineContext } from "./engine";

const unavailableRoads: RoadConditionProvider = {
  assess: async () => {
    throw new Error("Road condition service not configured");
  },
};

export function liveContext(): EngineContext {
  return {
    providers: {
      aurora: imoAuroraProvider,
      weather: openMeteoProvider,
      routing: estimateRoutingProvider,
      roads: unavailableRoads,
      cameras: null,
      vision: null,
    },
    locations: VIEWING_LOCATIONS,
    demo: false,
  };
}

export function resolveOrigin(lat: number, lon: number, label?: string | null): Origin {
  const clean = label?.trim().slice(0, 80);
  if (clean) return { lat, lon, label: clean };
  const town = nearestTown({ lat, lon });
  return { lat, lon, label: town ? town.name : "your location" };
}

export async function getRecommendations(params: {
  lat: number;
  lon: number;
  label?: string | null;
  travelMode: TravelMode;
  demo?: boolean;
}): Promise<RecommendationResponse> {
  return recommend({ origin: resolveOrigin(params.lat, params.lon, params.label), travelMode: params.travelMode, now: Date.now() }, liveContext());
}

export async function getLocationDetail(params: {
  id: string;
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
  travelMode: TravelMode;
}): Promise<LocationDetail | null> {
  const origin = params.lat != null && params.lon != null ? resolveOrigin(params.lat, params.lon, params.label) : null;
  return evaluateLocation({ locationId: params.id, origin, travelMode: params.travelMode, now: Date.now() }, liveContext());
}
