import type { RecommendationResponse } from "@/domain/types";
import { activityWord, darkSkyTile } from "@/lib/format";
import { formatDay, formatTime } from "@/lib/time";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <dt className="text-[11px] leading-tight text-ink-subtle">{label}</dt>
      <dd className="mt-1 text-[15px] leading-tight font-semibold text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 text-[11px] text-ink-subtle">{sub}</dd>}
    </div>
  );
}

export function TonightHeader({ data }: { data: RecommendationResponse }) {
  const dark = darkSkyTile(data.night, data.now);
  const { activity, available } = data.aurora;
  return (
    <header>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-balance">
        Tonight near {data.origin.label}
      </h1>
      <p className="mt-1 text-sm text-ink-subtle">
        {formatDay(data.now)} · updated {formatTime(data.generatedAt)} · Iceland time
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Tile
          label="Aurora activity"
          value={available && activity !== null ? `${activity} / 9` : "Unavailable"}
          sub={available && activity !== null ? activityWord(activity) : "Temporarily"}
        />
        <Tile label={dark.label} value={dark.value} />
        <Tile label="Conditions" value={data.summary.headline.replace(" tonight", "")} sub="tonight" />
      </dl>
    </header>
  );
}
