import type { LocationTimeScore } from "@/domain/types";

/** Tiny night-long chance trace; unreachable hours are drawn faint. Decorative (chances are in text). */
export function Sparkline({ hourly, className = "" }: { hourly: LocationTimeScore[]; className?: string }) {
  if (hourly.length < 2) return null;
  const w = 72;
  const h = 26;
  const pts = hourly.map((s, i) => [(i / (hourly.length - 1)) * w, h - 2 - (s.score / 100) * (h - 4)] as const);
  const firstReachable = hourly.findIndex((s) => s.reachable);
  const path = (from: number, to: number) => pts.slice(from, to).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className={className}>
      {firstReachable > 0 && <path d={path(0, firstReachable + 1)} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1.5" strokeLinecap="round" />}
      {firstReachable >= 0 && <path d={path(firstReachable, pts.length)} fill="none" stroke="#74e9b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
