import { z } from "zod";

import { CAMERA_WHITELIST } from "@/data/camera-metadata";
import type { CameraProvider } from "@/domain/providers";
import type { AuroraCameraMetadata, Camera, NearbyCamera } from "@/domain/types";
import { cached } from "@/lib/cache";
import { haversineKm } from "@/lib/geo";
import { fetchJson, fetchWithTimeout } from "@/lib/http";
import { HOUR, MINUTE } from "@/lib/time";

/** IRCA webcam data service (~165 stations, images refreshed several times an hour). */
export const IRCA_CAMERAS_URL = "https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1";
const MAX_IMAGE_BYTES = 2_000_000;

const cameraSchema = z.array(
  z.object({
    Maelist_nr: z.number(),
    Myndavel: z.string(),
    Vegheiti: z.string().nullable().optional(),
    NrVegur: z.string().nullable().optional(),
    Skyring: z.string().nullable().optional(),
    Slod: z.string().url(),
    Breidd: z.number(),
    Lengd: z.number(),
  }),
);

const DIRECTIONS: [string, number][] = [
  ["norðvestur", 315],
  ["norðaustur", 45],
  ["suðvestur", 225],
  ["suðaustur", 135],
  ["norður", 0],
  ["austur", 90],
  ["suður", 180],
  ["vestur", 270],
];

/** Parse "Hellisheiði séð til vesturs" → 270°, and spot cameras pointed down at the road. */
export function parseCameraView(description: string, cameraName: string): { directionDegrees?: number; facesRoad: boolean } {
  const text = description.toLowerCase().replace(cameraName.toLowerCase(), " ");
  const facesRoad = /niður á veg|niður brekku/.test(text);
  for (const [word, degrees] of DIRECTIONS) {
    if (new RegExp(`(^|[\\s,(\\-])${word}s?($|[\\s,.)])`).test(text)) return { directionDegrees: degrees, facesRoad };
  }
  return { facesRoad };
}

/** Northward views are best: in southern and western Iceland the aurora often sits low in the north. */
export function cameraMetadata(camera: Camera): AuroraCameraMetadata {
  const curated = CAMERA_WHITELIST[camera.id];
  if (curated) return { cameraId: camera.id, ...curated };
  if (camera.facesRoad) return { cameraId: camera.id, usefulForAurora: false, skyVisibilityScore: 0.1, directionDegrees: camera.directionDegrees };
  const d = camera.directionDegrees;
  const score =
    d === undefined ? 0.35 : d === 0 ? 0.5 : d === 45 || d === 315 ? 0.45 : d === 90 || d === 270 ? 0.4 : 0.3;
  return { cameraId: camera.id, usefulForAurora: true, skyVisibilityScore: score, directionDegrees: d };
}

export function normaliseCameras(raw: unknown): Camera[] {
  return cameraSchema.parse(raw).map((c, index) => {
    const description = (c.Skyring ?? c.Myndavel).trim();
    const fileId = c.Slod.match(/\/([^/]+)\.jpe?g$/i)?.[1];
    return {
      id: fileId ?? `${c.Maelist_nr}-${index}`,
      stationId: c.Maelist_nr,
      name: c.Myndavel.trim(),
      description,
      road: c.Vegheiti ?? undefined,
      roadNumber: c.NrVegur ?? undefined,
      latitude: c.Breidd,
      longitude: c.Lengd,
      imageUrl: c.Slod,
      ...parseCameraView(description, c.Myndavel.trim()),
    };
  });
}

const getAllCameras = () =>
  cached("irca:cameras", 12 * HOUR, async () => normaliseCameras(await fetchJson(IRCA_CAMERAS_URL, { timeoutMs: 10000 })), {
    staleMs: 48 * HOUR,
  });

async function findCamera(id: string): Promise<Camera | undefined> {
  return (await getAllCameras()).find((c) => c.id === id);
}

export const ircaCameraProvider: CameraProvider = {
  getAllCameras,

  async getNearbyCameras(lat, lon, radiusKm = 30) {
    const here = { lat, lon };
    return (await getAllCameras())
      .map((camera): NearbyCamera => ({
        camera,
        metadata: cameraMetadata(camera),
        distanceKm: Math.round(haversineKm(here, { lat: camera.latitude, lon: camera.longitude }) * 10) / 10,
      }))
      .filter((c) => c.distanceKm <= radiusKm)
      .sort(
        (a, b) =>
          b.metadata.skyVisibilityScore * (1 - (0.5 * b.distanceKm) / radiusKm) -
          a.metadata.skyVisibilityScore * (1 - (0.5 * a.distanceKm) / radiusKm),
      );
  },

  async getCameraImage(cameraId) {
    const camera = await findCamera(cameraId);
    if (!camera) return null;
    return cached(`irca:camera-image:${camera.id}`, 5 * MINUTE, async () => {
      const response = await fetchWithTimeout(camera.imageUrl, { timeoutMs: 8000 });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) throw new Error("Camera did not return an image");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Camera image too large");
      const lastModified = response.headers.get("last-modified");
      return { bytes, contentType, lastModified: lastModified ? new Date(lastModified).toISOString() : undefined };
    });
  },

  async getImageTimestamp(cameraId) {
    const camera = await findCamera(cameraId);
    if (!camera) return undefined;
    return cached(`irca:camera-time:${camera.id}`, 5 * MINUTE, async () => {
      const response = await fetchWithTimeout(camera.imageUrl, { method: "HEAD", timeoutMs: 5000 });
      const lastModified = response.headers.get("last-modified");
      return lastModified ? new Date(lastModified).toISOString() : undefined;
    });
  },
};
