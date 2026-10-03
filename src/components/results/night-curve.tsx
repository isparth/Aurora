import type { Recommendation } from "@/domain/types";
import { SLOT_MS } from "@/lib/scoring/windows";
import { formatTime } from "@/lib/time";

const W = 300;
const H = 56;

/**
 * Tonight at a glance: the chance through the night, the best window highlighted, the hours you
 * can't reach in time faded, and a "now" marker. Decorative — the same facts are given as text.
 */
export function NightCurve({ rec, now }: { rec: Recommendation; now: number }) {
  const hourly = rec.hourly;
  if (hourly.length < 3) return null;
  const t0 = Date.parse(hourly[0].time);
  const span = hourly.length * SLOT_MS;
  const x = (t: number) => Math.min(W, Math.max(0, ((t - t0) / span) * W));
  const y = (score: number) => H - 4 - (score / 100) * (H - 10);
  const pts = hourly.map((h) => [x(Date.parse(h.time) + SLOT_MS / 2), y(h.score)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  const arrival = x(Date.parse(rec.earliestArrival));
  const win = rec.bestWindow ? { a: x(Date.parse(rec.bestWindow.start)), b: x(Date.parse(rec.bestWindow.end)) } : null;
  const nowX = now >= t0 && now <= t0 + span ? x(now) : null;
  const ticks = hourly.filter((h) => new Date(h.time).getUTCMinutes() === 0).filter((_, k) => k % 2 === 0);

  return (
    <div aria-hidden className="relative select-none">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full overflow-visible">
        <defs>
          <linearGradient id={`nc-${rec.location.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#74e9b8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#74e9b8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {win && <rect x={win.a} y="0" width={Math.max(2, win.b - win.a)} height={H} rx="3" fill="rgb(116 233 184 / 0.12)" />}
        <path d={area} fill={`url(#nc-${rec.location.id})`} />
        <path d={line} fill="none" stroke="#74e9b8" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {arrival > 0 && <rect x="0" y="0" width={arrival} height={H} fill="rgb(3 5 10 / 0.6)" />}
        {nowX !== null && <line x1={nowX} x2={nowX} y1="0" y2={H} stroke="rgb(255 255 255 / 0.55)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {nowX !== null && (
        <span className="absolute top-0 -translate-x-1/2 rounded bg-night-950/90 px-1 text-[10px] leading-4 text-ink" style={{ left: `${(nowX / W) * 100}%` }}>
          now
        </span>
      )}
      <div className="relative mt-1 h-4 text-[10px] text-ink-subtle">
        {ticks.map((h) => (
          <span key={h.time} className="tabular absolute -translate-x-1/2" style={{ left: `${(x(Date.parse(h.time)) / W) * 100}%` }}>
            {formatTime(h.time)}
          </span>
        ))}
      </div>
    </div>
  );
}
