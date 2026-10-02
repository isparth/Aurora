import type { NextRequest } from "next/server";

import type { RoadStatus } from "@/domain/types";
import { errorResponse } from "@/features/recommendations/query";
import { loadRoadNetwork } from "@/features/roads/irca-provider";
import { describeError } from "@/lib/http";

/** Normalised IRCA road conditions. Add ?status=caution,closed to filter, ?geometry=true for lines. */
export async function GET(request: NextRequest) {
  const statusFilter = request.nextUrl.searchParams.get("status")?.split(",").filter(Boolean) as RoadStatus[] | undefined;
  const withGeometry = request.nextUrl.searchParams.get("geometry") === "true";
  try {
    const network = await loadRoadNetwork();
    const segments = network.segments
      .filter((s) => !statusFilter?.length || statusFilter.includes(s.status))
      .map(({ id, name, status, description, updatedAt, lines }) => ({
        id,
        name,
        status,
        description,
        updatedAt,
        ...(withGeometry ? { lines: lines.map((l) => l.map((p) => [p.lon, p.lat])) } : {}),
      }));
    const counts = network.segments.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});
    return Response.json({
      fetchedAt: network.fetchedAt,
      counts,
      segments,
      attribution: "Icelandic Road and Coastal Administration — road-condition data service (færð), CC BY 4.0",
    });
  } catch (error) {
    return errorResponse("UPSTREAM_UNAVAILABLE", `Road conditions unavailable — check umferdin.is (${describeError(error)}).`, 503);
  }
}
