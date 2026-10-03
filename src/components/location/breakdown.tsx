import type { ActivitySource, ScoreComponents } from "@/domain/types";
import { activityWord } from "@/lib/format";
import { ACTIVITY_SOURCE_LABEL, formatChance, skyDarknessLabel } from "@/lib/scoring/labels";

function Gate({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="tabular text-sm font-medium text-ink">{value}%</dd>
      <dd className="col-span-2">
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-ink/80" style={{ width: `${Math.max(2, value)}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-subtle">{detail}</p>
      </dd>
    </div>
  );
}

function ovalText(oval: ScoreComponents["oval"]): string {
  if (oval.position === "overhead") return "Auroral oval overhead — aurora can fill the sky.";
  const where = oval.position === "north" ? "north" : "south";
  return `Auroral oval ${oval.distanceDeg}° of geomagnetic latitude to the ${where} — aurora about ${oval.elevationDeg}° above the horizon.`;
}

/** The chance for one half hour, as the two gates it multiplies, with the inputs behind each. */
export function ScoreBreakdown({
  components: c,
  chance,
  kpSource,
  cameraObserved = false,
}: {
  components: ScoreComponents;
  chance: number;
  kpSource: ActivitySource;
  cameraObserved?: boolean;
}) {
  const sky = skyDarknessLabel(c);
  return (
    <div className="space-y-4">
      <dl className="space-y-3">
        <Gate label="Clear view of the sky" value={c.skyView} detail="Low and mid-level cloud, fog and rain between you and the aurora." />
        <Gate
          label="Aurora bright enough to see"
          value={c.aurora}
          detail={`Activity Kp ${c.kp} (${activityWord(c.kp).toLowerCase()}) · ${ovalText(c.oval)}`}
        />
      </dl>
      <p className="tabular text-sm text-ink">
        {c.skyView}% × {c.aurora}% ≈ <span className="font-semibold">{formatChance(chance)}</span> chance this half hour
      </p>
      <ul className="space-y-1.5 border-t border-line pt-3 text-xs text-ink-subtle">
        <li>
          <span className="text-ink-muted">Activity:</span> {ACTIVITY_SOURCE_LABEL[kpSource]}
        </li>
        <li>
          <span className="text-ink-muted">Sky:</span> {sky.label} — {sky.detail.toLowerCase()}. Faintest visible aurora ≈ {c.thresholdKr} kR
          (1 kR is about the brightness of the Milky Way).
        </li>
        <li>
          <span className="text-ink-muted">Camera:</span>{" "}
          {c.camera !== null
            ? `${c.camera}% clear sky in a nearby camera, blended into the forecast for the next two hours.`
            : cameraObserved
              ? "not used for this time — a camera image only informs the next two hours."
              : "no camera evidence."}
        </li>
      </ul>
    </div>
  );
}
