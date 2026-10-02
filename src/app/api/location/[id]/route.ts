import type { NextRequest } from "next/server";

import { errorResponse, parseDetailQuery } from "@/features/recommendations/query";
import { getLocationDetail } from "@/features/recommendations/service";

/** One destination evaluated across the night; lat/lon are optional (travel is ignored without them). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = parseDetailQuery(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.ok) return errorResponse("INVALID_QUERY", query.message, 400);

  try {
    const detail = await getLocationDetail({ id, ...query.value });
    if (!detail) return errorResponse("NOT_FOUND", "No viewing location with that id.", 404);
    return Response.json(detail);
  } catch (error) {
    console.error("location detail failed", error);
    return errorResponse("INTERNAL_ERROR", "Could not evaluate this location.", 500);
  }
}
