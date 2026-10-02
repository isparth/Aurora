import { imoAuroraProvider } from "@/features/aurora/imo-provider";
import { errorResponse } from "@/features/recommendations/query";
import { describeError } from "@/lib/http";

/** IMO aurora activity forecast (0–9 scale — not Kp), normalised. */
export async function GET() {
  try {
    return Response.json(await imoAuroraProvider.getForecast());
  } catch (error) {
    return errorResponse("UPSTREAM_UNAVAILABLE", `Aurora forecast temporarily unavailable (${describeError(error)}).`, 503);
  }
}
