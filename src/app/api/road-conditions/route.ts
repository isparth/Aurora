import type { NextRequest } from "next/server";
import { z } from "zod";

import { cdnCache, errorResponse } from "@/features/recommendations/query";
import { loadRoadNetwork } from "@/features/roads/irca-provider";
import { describeError } from "@/lib/http";

const querySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(["good", "caution", "difficult", "closed", "unknown"]))),
  geometry: z.enum(["true", "false"]).optional(),
});

/** Normalised IRCA road conditions. Add ?status=caution,closed to filter, ?geometry=true for lines. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return errorResponse("INVALID_QUERY", z.prettifyError(parsed.error), 400);
  const { status: statusFilter, geometry } = parsed.data;
  try {
    const network = await loadRoadNetwork();
    const segments = network.segments
      .filter((s) => statusFilter.length === 0 || statusFilter.includes(s.status))
      .map(({ id, name, status, description, updatedAt, lines }) => ({
        id,
        name,
        status,
        description,
        updatedAt,
        ...(geometry === "true" ? { lines: lines.map((l) => l.map((p) => [p.lon, p.lat])) } : {}),
      }));
    const counts = network.segments.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});
    return Response.json(
      {
        fetchedAt: network.fetchedAt,
        counts,
        segments,
        attribution: "Icelandic Road and Coastal Administration — road-condition data service (færð), CC BY 4.0",
      },
      { headers: cdnCache(120) },
    );
  } catch (error) {
    return errorResponse("UPSTREAM_UNAVAILABLE", `Road conditions unavailable — check umferdin.is (${describeError(error)}).`, 503);
  }
}
