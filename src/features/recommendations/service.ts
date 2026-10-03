import { nearestTown, REYKJAVIK } from "@/data/towns";
import { VIEWING_LOCATIONS } from "@/data/viewing-locations";
import type { LocationDetail, Origin, RecommendationResponse, TravelMode } from "@/domain/types";
import { activityForNight, imoAuroraProvider } from "@/features/aurora/imo-provider";
import { ircaCameraProvider } from "@/features/cameras/irca-cameras";
import { selectVisionProvider } from "@/features/cameras/vision";
import { DEMO_NOW, demoContext } from "@/features/demo/demo-providers";
import { ircaRoadProvider } from "@/features/roads/irca-provider";
import { selectRoutingProvider } from "@/features/routing/providers";
import { noaaSpaceWeatherProvider } from "@/features/space-weather/noaa-provider";
import { openMeteoProvider } from "@/features/weather/open-meteo-provider";

import { evaluateLocation, recommend, type EngineContext } from "./engine";
import { computeNight } from "./night";

export type TonightGlance = {
  /** IMO's Kp forecast for midnight; null when IMO is unavailable or has no forecast for tonight. */
  activity: number | null;
  /** Reykjavík's dark hours tonight; null in the bright summer months. */
  dark: { from: string; until: string } | null;
};

/** A quick, location-free read on tonight for the home page (Reykjavík darkness + IMO activity). */
export async function getTonightGlance(now = Date.now()): Promise<TonightGlance> {
  const night = computeNight(REYKJAVIK, now);
  if (!night) return { activity: null, dark: null };
  const forecast = await imoAuroraProvider.getForecast().catch(() => null);
  return {
    activity: forecast ? activityForNight(forecast, night.eveningDate).activity : null,
    dark: { from: new Date(night.darkFrom ?? night.start).toISOString(), until: new Date(night.darkUntil ?? night.end).toISOString() },
  };
}

export function liveContext(): EngineContext {
  return {
    providers: {
      aurora: imoAuroraProvider,
      spaceWeather: noaaSpaceWeatherProvider,
      weather: openMeteoProvider,
      routing: selectRoutingProvider(),
      roads: ircaRoadProvider,
      cameras: ircaCameraProvider,
      vision: selectVisionProvider(),
    },
    locations: VIEWING_LOCATIONS,
    demo: false,
  };
}

const contextFor = (demo?: boolean) => (demo ? { ctx: demoContext(), now: DEMO_NOW } : { ctx: liveContext(), now: Date.now() });

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
  const { ctx, now } = contextFor(params.demo);
  return recommend({ origin: resolveOrigin(params.lat, params.lon, params.label), travelMode: params.travelMode, now }, ctx);
}

export async function getLocationDetail(params: {
  id: string;
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
  travelMode: TravelMode;
  demo?: boolean;
}): Promise<LocationDetail | null> {
  // Demo origin defaults to Reykjavík, matching the demo results page.
  if (params.demo && (params.lat == null || params.lon == null)) params = { ...params, lat: REYKJAVIK.lat, lon: REYKJAVIK.lon, label: "Reykjavík" };
  const { ctx, now } = contextFor(params.demo);
  const origin = params.lat != null && params.lon != null ? resolveOrigin(params.lat, params.lon, params.label) : null;
  return evaluateLocation({ locationId: params.id, origin, travelMode: params.travelMode, now }, ctx);
}
