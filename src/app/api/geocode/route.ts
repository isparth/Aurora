import type { NextRequest } from "next/server";

import { searchPlaces } from "@/features/geocoding/search";
import { errorResponse } from "@/features/recommendations/query";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return errorResponse("INVALID_QUERY", "q must be 2–80 characters.", 400);
  const { results, remote } = await searchPlaces(q);
  return Response.json({ results, remote }, { headers: { "Cache-Control": "public, max-age=300" } });
}
