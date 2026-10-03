import type { ScoreLabel } from "@/domain/types";
import { formatChance, scoreLabel } from "@/lib/scoring/labels";

export const LABEL_STYLE: Record<ScoreLabel, { text: string; dot: string; stroke: string; soft: string }> = {
  Excellent: { text: "text-score-excellent", dot: "bg-score-excellent", stroke: "#74e9b8", soft: "bg-score-excellent/12" },
  Good: { text: "text-score-good", dot: "bg-score-good", stroke: "#9fdcf0", soft: "bg-score-good/12" },
  Fair: { text: "text-score-fair", dot: "bg-score-fair", stroke: "#f2cf7c", soft: "bg-score-fair/12" },
  Poor: { text: "text-score-poor", dot: "bg-score-poor", stroke: "#f2a3ad", soft: "bg-score-poor/12" },
};

export const styleFor = (chance: number) => LABEL_STYLE[scoreLabel(chance)];

/** A 0–100 chance of seeing the aurora, rounded to 5%, with its label. */
export function ScoreBadge({ score, className = "" }: { score: number; className?: string }) {
  const s = styleFor(score);
  return (
    <span className={`inline-flex flex-col items-end leading-none ${className}`}>
      <span className={`tabular text-xl font-semibold tracking-tight ${s.text}`}>{formatChance(score)}</span>
      <span className="sr-only">chance,</span>
      <span className="mt-1 text-[11px] font-medium text-ink-subtle">{scoreLabel(score)}</span>
    </span>
  );
}
