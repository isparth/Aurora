import type { NextRequest } from "next/server";
import { z } from "zod";

import { ircaCameraProvider } from "@/features/cameras/irca-cameras";
import { cdnCache, errorResponse } from "@/features/recommendations/query";
import { describeError } from "@/lib/http";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(100).default(30),
});

/** IRCA road cameras near a point, ranked by usefulness for watching the sky. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return errorResponse("INVALID_QUERY", z.prettifyError(parsed.error), 400);
  try {
    const cameras = await ircaCameraProvider.getNearbyCameras(parsed.data.lat, parsed.data.lon, parsed.data.radius);
    return Response.json(
      { cameras, attribution: "Icelandic Road and Coastal Administration — webcam data service (CC BY 4.0)" },
      { headers: cdnCache(600) },
    );
  } catch (error) {
    return errorResponse("UPSTREAM_UNAVAILABLE", `Road cameras temporarily unavailable (${describeError(error)}).`, 503);
  }
}
