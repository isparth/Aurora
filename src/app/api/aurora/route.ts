import { imoAuroraProvider } from "@/features/aurora/imo-provider";
import { cdnCache, errorResponse } from "@/features/recommendations/query";
import { describeError } from "@/lib/http";

/** IMO aurora forecast (expected Kp at midnight for each night), normalised. */
export async function GET() {
  try {
    return Response.json(await imoAuroraProvider.getForecast(), { headers: cdnCache(300) });
  } catch (error) {
    return errorResponse("UPSTREAM_UNAVAILABLE", `Aurora forecast temporarily unavailable (${describeError(error)}).`, 503);
  }
}
