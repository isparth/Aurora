import type { ConditionsAtTime, MoonInfo, RoadSafety, ViewingLocation } from "@/domain/types";
import { darknessLabel } from "@/lib/astronomy/darkness";
import { pct, ROAD_TONE } from "@/lib/format";
import { cloudLabel, lightPollutionLabel, ROAD_STATUS_LABEL } from "@/lib/scoring/labels";
import { formatTime } from "@/lib/time";

function Cell({ label, value, sub, tone = "text-ink", wide = false }: { label: string; value: string; sub?: string; tone?: string; wide?: boolean }) {
  return (
    <div className={`border-t border-line py-3 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={`tabular mt-1 text-[15px] font-semibold ${tone}`}>{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-subtle">{sub}</dd>}
    </div>
  );
}

const num = (v: number | undefined, unit: string, digits = 0) => (v === undefined ? "—" : `${v.toFixed(digits)} ${unit}`);

export function ConditionsGrid({
  c,
  moon,
  road,
  location,
}: {
  c: ConditionsAtTime;
  moon: MoonInfo | null;
  road: RoadSafety;
  location: ViewingLocation;
}) {
  const layers =
    c.clouds.low !== undefined && c.clouds.middle !== undefined && c.clouds.high !== undefined
      ? `Low ${pct(c.clouds.low)} · mid ${pct(c.clouds.middle)} · high ${pct(c.clouds.high)}`
      : cloudLabel(c.clouds.total);
  const moonTimes = moon ? [moon.rise && `rises ${formatTime(moon.rise)}`, moon.set && `sets ${formatTime(moon.set)}`].filter(Boolean).join(", ") : "";

  return (
    <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
      <Cell label="Cloud cover" value={pct(c.clouds.total)} sub={layers} wide />
      <Cell label="Aurora activity" value={c.auroraActivity === null ? "Unavailable" : `${c.auroraActivity} / 9`} sub="IMO forecast" />
      <Cell
        label="Darkness"
        value={darknessLabel(c.sunAltitude)}
        sub={`Sun ${Math.abs(Math.round(c.sunAltitude))}° ${c.sunAltitude < 0 ? "below" : "above"} the horizon`}
      />
      <Cell
        label="Moon"
        value={`${pct(c.moonIllumination)} lit`}
        sub={`${c.moonAltitude > 0 ? "Above" : "Below"} the horizon${moon ? ` · ${moon.phaseName}` : ""}${moonTimes ? ` · ${moonTimes}` : ""}`}
      />
      <Cell label="Wind" value={num(c.windKph, "km/h")} sub={c.gustKph !== undefined ? `Gusts ${Math.round(c.gustKph)} km/h` : undefined} />
      <Cell label="Temperature" value={c.temperatureC === undefined ? "—" : `${Math.round(c.temperatureC)}°C`} />
      <Cell label="Precipitation" value={num(c.precipitationMm, "mm/h", 1)} />
      <Cell label="Visibility" value={c.visibilityKm === undefined ? "—" : `${Math.round(c.visibilityKm)} km`} />
      <Cell label="Light pollution" value={lightPollutionLabel(location.lightPollutionScore)} sub="Estimated for this site" />
      <Cell label="Road conditions" value={ROAD_STATUS_LABEL[road.status]} tone={ROAD_TONE[road.status]} sub={road.description} wide />
    </dl>
  );
}
