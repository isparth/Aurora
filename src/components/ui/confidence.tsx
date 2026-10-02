import type { Confidence } from "@/domain/types";

const LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
const LABEL: Record<Confidence, string> = { low: "Low", medium: "Medium", high: "High" };

/** Forecast confidence, shown with filled bars as well as text so it never relies on colour. */
export function ConfidenceChip({ value, className = "" }: { value: Confidence; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted ${className}`}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-1 rounded-sm ${i <= LEVEL[value] ? "bg-ink" : "bg-white/15"}`} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      Forecast confidence: <span className="font-medium text-ink">{LABEL[value]}</span>
    </span>
  );
}
