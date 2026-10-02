"use client";

import { useMemo, useSyncExternalStore } from "react";

export type RecentPlace = { name: string; lat: number; lon: number };

const KEY = "aurora:recent-places";
const MAX = 3;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** localStorage is user-controlled: keep only well-formed entries. */
function parse(raw: string | null): RecentPlace[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (p): p is RecentPlace =>
          typeof p?.name === "string" && p.name.length <= 80 && Number.isFinite(p?.lat) && Number.isFinite(p?.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180,
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveRecentPlace(place: RecentPlace): void {
  try {
    const rest = parse(readRaw()).filter((p) => p.name !== place.name);
    window.localStorage.setItem(KEY, JSON.stringify([place, ...rest].slice(0, MAX)));
    listeners.forEach((notify) => notify());
  } catch {
    // Private mode or storage disabled: recents are a convenience, not a requirement.
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/** Places this browser searched recently (nothing leaves the device). */
export function useRecentPlaces(): RecentPlace[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}
