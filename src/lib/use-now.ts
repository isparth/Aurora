"use client";

import { useEffect, useState } from "react";

/**
 * A clock that starts at the server's `now` (so the first render matches the HTML) and then ticks,
 * keeping "leave in 12 min" honest while the page stays open. Frozen for the deterministic demo.
 */
export function useNow(initial: string | number, { frozen = false, intervalMs = 30_000 } = {}): number {
  const start = typeof initial === "number" ? initial : Date.parse(initial);
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [frozen, intervalMs]);
  return frozen ? start : Math.max(now, start);
}
