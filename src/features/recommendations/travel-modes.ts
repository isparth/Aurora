import type { TravelMode } from "@/domain/types";

export const TRAVEL_MODES: Record<TravelMode, { label: string; maxMinutes: number; hint: string }> = {
  nearby: { label: "Nearby", maxMinutes: 30, hint: "Up to 30 min" },
  standard: { label: "Standard", maxMinutes: 75, hint: "Up to 75 min" },
  chase: { label: "Aurora chase", maxMinutes: 150, hint: "Up to 2½ h" },
};

export const DEFAULT_TRAVEL_MODE: TravelMode = "standard";

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === "string" && value in TRAVEL_MODES;
}
