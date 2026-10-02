import type { NextRequest } from "next/server";

import { cdnCache, errorResponse, parseRecommendationQuery } from "@/features/recommendations/query";
import { getRecommendations } from "@/features/recommendations/service";

export async function GET(request: NextRequest) {
  const query = parseRecommendationQuery(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.ok) return errorResponse("INVALID_QUERY", query.message, 400);
  try {
    return Response.json(await getRecommendations(query.value), { headers: cdnCache(60) });
  } catch (error) {
    console.error("recommendations failed", error);
    return errorResponse("INTERNAL_ERROR", "Could not compute recommendations.", 500);
  }
}
