import type { TravelMode } from "@/domain/types";

export const TRAVEL_MODES: Record<TravelMode, { label: string; maxMinutes: number; hint: string; phrase: string }> = {
  nearby: { label: "30 min", maxMinutes: 30, hint: "Nearby", phrase: "a 30-minute drive" },
  standard: { label: "75 min", maxMinutes: 75, hint: "Standard", phrase: "a 75-minute drive" },
  chase: { label: "2½ hours", maxMinutes: 150, hint: "Aurora chase", phrase: "a 2½-hour drive" },
};

export const DEFAULT_TRAVEL_MODE: TravelMode = "standard";

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === "string" && value in TRAVEL_MODES;
}
