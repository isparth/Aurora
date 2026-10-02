import { ircaCameraProvider } from "@/features/cameras/irca-cameras";
import { errorResponse } from "@/features/recommendations/query";

/**
 * Latest image for one IRCA camera. Only camera ids from the official feed are accepted,
 * so this can never be used to fetch arbitrary URLs. Cached for five minutes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,80}$/.test(id)) return errorResponse("INVALID_ID", "Invalid camera id.", 400);
  try {
    const image = await ircaCameraProvider.getCameraImage(id);
    if (!image) return errorResponse("NOT_FOUND", "Unknown camera.", 404);
    return new Response(image.bytes as BodyInit, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        ...(image.lastModified ? { "Last-Modified": new Date(image.lastModified).toUTCString() } : {}),
        "X-Attribution": "Icelandic Road and Coastal Administration, CC BY 4.0",
      },
    });
  } catch {
    return errorResponse("UPSTREAM_UNAVAILABLE", "Camera image temporarily unavailable.", 503);
  }
}
