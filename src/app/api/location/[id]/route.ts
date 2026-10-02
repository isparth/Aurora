import type { NextRequest } from "next/server";

import { DEFAULT_TRAVEL_MODE } from "@/features/recommendations/travel-modes";
import { errorResponse, parseRecommendationQuery } from "@/features/recommendations/query";
import { getLocationDetail } from "@/features/recommendations/service";

/** One destination evaluated across the night; lat/lon are optional (travel is ignored without them). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const query = parseRecommendationQuery(raw);
  const demo = raw.demo === "true" || raw.demo === "1";
  if (!query.ok && (raw.lat || raw.lon)) return errorResponse("INVALID_QUERY", query.message, 400);
  const q = query.ok ? query.value : { lat: undefined, lon: undefined, label: undefined, travelMode: DEFAULT_TRAVEL_MODE, demo };

  try {
    const detail = await getLocationDetail({ id, lat: q.lat, lon: q.lon, label: q.label, travelMode: q.travelMode, demo: q.demo });
    if (!detail) return errorResponse("NOT_FOUND", `No viewing location with id "${id}".`, 404);
    return Response.json(detail);
  } catch (error) {
    console.error("location detail failed", error);
    return errorResponse("INTERNAL_ERROR", "Could not evaluate this location.", 500);
  }
}
