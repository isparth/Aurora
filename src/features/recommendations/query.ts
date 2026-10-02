import { z } from "zod";

import { REYKJAVIK } from "@/data/towns";
import type { TravelMode } from "@/domain/types";

import { DEFAULT_TRAVEL_MODE } from "./travel-modes";

export type RecommendationQuery = {
  lat: number;
  lon: number;
  label?: string;
  travelMode: TravelMode;
  demo: boolean;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  mode: z.enum(["nearby", "standard", "chase"]).optional(),
  label: z.string().trim().max(80).optional(),
  demo: z.enum(["true", "1", "false", "0"]).optional(),
});

/**
 * Validate query parameters at the boundary. `mode` and `travelMode` are both accepted.
 * Demo mode falls back to Reykjavík when no coordinates are given.
 */
export function parseRecommendationQuery(params: RawParams): { ok: true; value: RecommendationQuery } | { ok: false; message: string } {
  const parsed = schema.safeParse({
    lat: first(params.lat) || undefined,
    lon: first(params.lon) || undefined,
    mode: first(params.mode) ?? first(params.travelMode),
    label: first(params.label) || undefined,
    demo: first(params.demo),
  });
  if (!parsed.success) return { ok: false, message: z.prettifyError(parsed.error) };

  const { lat, lon, mode, label, demo } = parsed.data;
  const isDemo = demo === "true" || demo === "1";
  const travelMode = mode ?? DEFAULT_TRAVEL_MODE;

  if (lat === undefined || lon === undefined) {
    if (!isDemo) return { ok: false, message: "Both lat and lon are required." };
    return { ok: true, value: { lat: REYKJAVIK.lat, lon: REYKJAVIK.lon, label: label ?? "Reykjavík", travelMode, demo: true } };
  }
  return { ok: true, value: { lat, lon, label: label || undefined, travelMode, demo: isDemo } };
}

export const isDemoParam = (params: RawParams) => {
  const demo = first(params.demo);
  return demo === "true" || demo === "1";
};

/**
 * Detail-page variant: the origin is optional (no travel is applied without one), but whatever
 * *is* supplied must still be valid.
 */
export function parseDetailQuery(
  params: RawParams,
): { ok: true; value: Partial<Pick<RecommendationQuery, "lat" | "lon" | "label">> & Pick<RecommendationQuery, "travelMode" | "demo"> } | { ok: false; message: string } {
  const hasOrigin = Boolean(first(params.lat) || first(params.lon));
  const parsed = parseRecommendationQuery(hasOrigin ? params : { ...params, demo: "true", lat: undefined, lon: undefined });
  if (!parsed.ok) return parsed;
  const demo = isDemoParam(params);
  return hasOrigin ? { ok: true, value: { ...parsed.value, demo } } : { ok: true, value: { travelMode: parsed.value.travelMode, demo } };
}

/** Shared-cache (CDN) headers for public, non-personal API responses. */
export const cdnCache = (seconds: number, staleSeconds = seconds * 4) => ({
  "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`,
});

export function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}
