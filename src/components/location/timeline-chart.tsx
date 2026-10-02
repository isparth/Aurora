"use client";

import { useRef, type KeyboardEvent } from "react";

import type { LocationTimeScore, Recommendation } from "@/domain/types";
import { SLOT_MS } from "@/lib/scoring/windows";
import { formatTime } from "@/lib/time";

const W = 1000;
const H = 200;
const PAD_TOP = 18;
const PAD_BOTTOM = 6;

const y = (score: number) => PAD_TOP + (1 - score / 100) * (H - PAD_TOP - PAD_BOTTOM);

function smoothPath(points: [number, number][]): string {
  return points
    .map(([px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = points[i - 1];
      const mx = (qx + px) / 2;
      return `C${mx},${qy} ${mx},${py} ${px},${py}`;
    })
    .join(" ");
}

/** Night-long score chart. Each 30-minute slot is a radio button, so it works with touch, mouse and keyboard. */
export function TimelineChart({
  hourly,
  bestWindow,
  earliestArrival,
  selectedIndex,
  onSelect,
}: {
  hourly: LocationTimeScore[];
  bestWindow: Recommendation["bestWindow"];
  earliestArrival: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const n = hourly.length;
  if (n === 0) return null;

  const t0 = Date.parse(hourly[0].time);
  const span = n * SLOT_MS;
  const pos = (time: number) => Math.min(1, Math.max(0, (time - t0) / span));
  const x = (i: number) => ((i + 0.5) / n) * W;

  const points = hourly.map((s, i) => [x(i), y(s.score)] as [number, number]);
  const line = smoothPath(points);
  const area = `${line} L${x(n - 1)},${H} L${x(0)},${H} Z`;

  const arrival = pos(Date.parse(earliestArrival));
  const win = bestWindow ? { from: pos(Date.parse(bestWindow.start)), to: pos(Date.parse(bestWindow.end)) } : null;
  const peakIndex = bestWindow ? hourly.findIndex((s) => s.time === bestWindow.peak) : -1;
  const selected = hourly[selectedIndex];
  const hourTicks = hourly.map((s, i) => ({ s, i })).filter(({ s }) => new Date(s.time).getUTCMinutes() === 0);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const next =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? Math.min(n - 1, selectedIndex + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? Math.max(0, selectedIndex - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div className="relative h-52 select-none sm:h-60">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#74e9b8" stopOpacity="0.38" />
              <stop offset="1" stopColor="#74e9b8" stopOpacity="0" />
            </linearGradient>
            <pattern id="tl-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="14" stroke="rgb(255 255 255 / 0.07)" strokeWidth="6" />
            </pattern>
          </defs>
          {[25, 50, 75].map((g) => (
            <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="rgb(255 255 255 / 0.06)" vectorEffect="non-scaling-stroke" />
          ))}
          {arrival > 0 && <rect x="0" y="0" width={arrival * W} height={H} fill="url(#tl-hatch)" />}
          {win && <rect x={win.from * W} y="0" width={(win.to - win.from) * W} height={H} fill="rgb(116 233 184 / 0.08)" />}
          <path d={area} fill="url(#tl-fill)" />
          <path d={line} fill="none" stroke="#74e9b8" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="0" y2={H} stroke="rgb(255 255 255 / 0.45)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        </svg>

        {arrival > 0.08 && (
          <span className="absolute bottom-1 left-1 max-w-[30%] text-[11px] leading-tight text-ink-subtle">Before you could arrive</span>
        )}
        {win && (
          <span
            className="absolute bottom-1.5 -translate-x-1/2 rounded-full bg-night-950/70 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-aurora-200"
            style={{ left: `${Math.min(85, Math.max(15, ((win.from + win.to) / 2) * 100))}%` }}
          >
            Best {formatTime(bestWindow!.start)}–{formatTime(bestWindow!.end)}
          </span>
        )}
        {peakIndex >= 0 && (
          <span
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-full text-sm text-aurora-200"
            style={{ left: `${(x(peakIndex) / W) * 100}%`, top: `${(y(hourly[peakIndex].score) / H) * 100}%` }}
          >
            ★
          </span>
        )}
        <span
          aria-hidden
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-night-950 bg-ink"
          style={{ left: `${(x(selectedIndex) / W) * 100}%`, top: `${(y(selected.score) / H) * 100}%` }}
        />

        <div role="radiogroup" aria-label="Viewing score through the night" className="absolute inset-0 flex">
          {hourly.map((s, i) => (
            <button
              key={s.time}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={i === selectedIndex}
              tabIndex={i === selectedIndex ? 0 : -1}
              aria-label={`${formatTime(s.time)}, score ${s.score}${i === peakIndex ? ", best" : ""}${s.reachable ? "" : ", before you could arrive"}`}
              onClick={() => onSelect(i)}
              onKeyDown={onKeyDown}
              className="h-full flex-1 rounded-sm focus-visible:outline-offset-[-2px] hover:bg-white/[0.03]"
            />
          ))}
        </div>
      </div>

      <div aria-hidden className="relative mt-2 h-4 text-[11px] text-ink-subtle">
        {hourTicks.map(({ s, i }, k) => (
          <span
            key={s.time}
            className={`tabular absolute -translate-x-1/2 ${k % 2 === 1 ? "hidden sm:inline" : ""}`}
            style={{ left: `${(i / n) * 100}%` }}
          >
            {formatTime(s.time)}
          </span>
        ))}
      </div>
    </div>
  );
}
