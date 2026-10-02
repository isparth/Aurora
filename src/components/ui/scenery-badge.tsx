import { Mountain } from "lucide-react";

import { sceneryLabel } from "@/lib/scoring/labels";

/** "Iconic spot" / "Scenic spot" pill. Plainer settings get no badge rather than a negative one. */
export function SceneryBadge({ scenery, compact = false, className = "" }: { scenery: number; compact?: boolean; className?: string }) {
  const label = sceneryLabel(scenery);
  if (!label) return null;
  const iconic = label === "Iconic spot";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        iconic ? "border-dusk-300/40 text-dusk-300" : "border-line-strong text-ink-muted"
      } ${className}`}
    >
      <Mountain aria-hidden className="h-3 w-3" />
      {compact ? label.replace(" spot", "") : label}
    </span>
  );
}
