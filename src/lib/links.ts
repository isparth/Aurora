import type { TravelMode } from "@/domain/types";

export type PlaceParams = {
  lat?: number;
  lon?: number;
  label?: string;
  mode?: TravelMode;
  demo?: boolean;
};

function query(p: PlaceParams): string {
  const params = new URLSearchParams();
  if (p.lat !== undefined && p.lon !== undefined) {
    params.set("lat", p.lat.toFixed(5));
    params.set("lon", p.lon.toFixed(5));
  }
  if (p.label) params.set("label", p.label);
  if (p.mode && p.mode !== "standard") params.set("mode", p.mode);
  if (p.demo) params.set("demo", "true");
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const resultsHref = (p: PlaceParams) => `/results${query(p)}`;
export const locationHref = (id: string, p: PlaceParams) => `/location/${encodeURIComponent(id)}${query(p)}`;

/** Google Maps directions URL (no API key). Omitting the origin lets phones start from the current position. */
export function directionsHref(lat: number, lon: number): string {
  const params = new URLSearchParams({ api: "1", destination: `${lat},${lon}`, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function cameraImageSrc(camera: { id: string; imageUrl: string }): string {
  return camera.imageUrl.startsWith("/") ? camera.imageUrl : `/api/cameras/${encodeURIComponent(camera.id)}/image`;
}
