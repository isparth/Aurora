import { VIEWING_LOCATIONS } from "@/data/viewing-locations";

export function GET() {
  return Response.json({ locations: VIEWING_LOCATIONS }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
