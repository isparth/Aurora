import type { AuroraCameraMetadata } from "@/domain/types";

/**
 * Manually reviewed IRCA road cameras that show a useful band of open sky.
 * Everything else gets a heuristic score from its stated viewing direction.
 */
export const CAMERA_WHITELIST: Record<string, Omit<AuroraCameraMetadata, "cameraId">> = {
  gjabakki_3: { usefulForAurora: true, skyVisibilityScore: 0.6, directionDegrees: 0 },
  lyngdalsheidi_3: { usefulForAurora: true, skyVisibilityScore: 0.6, directionDegrees: 90 },
  mosfellsheidi_3: { usefulForAurora: true, skyVisibilityScore: 0.55, directionDegrees: 90 },
  hellisheidi_1: { usefulForAurora: true, skyVisibilityScore: 0.55, directionDegrees: 270 },
  svinavatn_3: { usefulForAurora: true, skyVisibilityScore: 0.45, directionDegrees: 0 },
};
