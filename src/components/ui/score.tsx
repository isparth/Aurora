import type { ScoreLabel } from "@/domain/types";
import { scoreLabel } from "@/lib/scoring/labels";

export const LABEL_STYLE: Record<ScoreLabel, { text: string; dot: string; stroke: string; soft: string }> = {
  Excellent: { text: "text-score-excellent", dot: "bg-score-excellent", stroke: "#74e9b8", soft: "bg-score-excellent/12" },
  Good: { text: "text-score-good", dot: "bg-score-good", stroke: "#9fdcf0", soft: "bg-score-good/12" },
  Fair: { text: "text-score-fair", dot: "bg-score-fair", stroke: "#f2cf7c", soft: "bg-score-fair/12" },
  Poor: { text: "text-score-poor", dot: "bg-score-poor", stroke: "#f2a3ad", soft: "bg-score-poor/12" },
};

export const styleFor = (score: number) => LABEL_STYLE[scoreLabel(score)];

/** Large 0–100 score with a progress ring. The label is always shown as text, not colour alone. */
export function ScoreDial({ score, size = 112, caption = "Viewing score" }: { score: number; size?: number; caption?: string }) {
  const label = scoreLabel(score);
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={LABEL_STYLE[label].stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(c * score) / 100} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tabular text-[2.6em] leading-none font-semibold tracking-tight" style={{ fontSize: size * 0.36 }}>
            {score}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm text-ink-muted">{caption}</p>
        <p className={`mt-0.5 text-lg font-semibold ${LABEL_STYLE[label].text}`}>{label}</p>
        <p className="sr-only">
          {score} out of 100, {label}
        </p>
      </div>
    </div>
  );
}

export function ScoreBadge({ score, className = "" }: { score: number; className?: string }) {
  const s = styleFor(score);
  return (
    <span className={`inline-flex flex-col items-end leading-none ${className}`}>
      <span className={`tabular text-2xl font-semibold tracking-tight ${s.text}`}>{score}</span>
      <span className="sr-only">out of 100,</span>
      <span className="mt-1 text-[11px] font-medium text-ink-subtle">{scoreLabel(score)}</span>
    </span>
  );
}
