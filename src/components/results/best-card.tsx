import { ArrowRight, Navigation } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { ConfidenceChip } from "@/components/ui/confidence";
import { ScoreDial } from "@/components/ui/score";
import type { Recommendation } from "@/domain/types";
import { distanceText, driveText, leaveText, pct, ROAD_TONE, windowText } from "@/lib/format";
import { directionsHref } from "@/lib/links";
import { darknessQualityLabel, lightPollutionLabel, ROAD_STATUS_LABEL } from "@/lib/scoring/labels";

import { ReasonList } from "./reason-list";

function Plan({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={`tabular mt-1 text-xl leading-tight font-semibold whitespace-nowrap ${accent ? "text-aurora-300" : "text-ink"}`}>{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-subtle">{sub}</dd>}
    </div>
  );
}

function Row({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular font-medium ${tone}`}>{value}</dd>
    </div>
  );
}

export function BestCard({ rec, detailHref, auroraActivity }: { rec: Recommendation; detailHref: string; auroraActivity: number | null }) {
  const c = rec.conditions;
  const leave = leaveText(rec);
  return (
    <article aria-labelledby="best-title" className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white/[0.07] to-white/[0.015] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 h-64 w-64 rounded-full bg-aurora-400/14 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-aurora-300 uppercase">Best tonight</p>
        <ConfidenceChip value={rec.confidence} />
      </div>

      <h2 id="best-title" className="relative mt-3 text-[1.65rem] leading-tight font-semibold tracking-tight">
        {rec.location.name}
      </h2>
      <p className="relative text-sm text-ink-subtle">{rec.location.region}</p>

      <div className="relative mt-5">
        <ScoreDial score={rec.viewingScore} />
      </div>

      <dl className="relative mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl border border-line bg-night-900/60 p-3.5">
        <Plan label="Best viewing" value={windowText(rec.bestWindow)} />
        <Plan label={rec.leaveNow ? "Departure" : "Leave around"} value={rec.leaveNow ? "Now" : leave.replace("Leave around ", "")} accent />
        <div className="col-span-2 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
          <dt className="text-ink-subtle">Drive</dt>
          <dd className="tabular text-right text-ink">
            {driveText(rec.travel)} <span className="text-ink-subtle">· {distanceText(rec.travel)}</span>
          </dd>
        </div>
      </dl>

      {c && (
        <dl className="relative mt-4 divide-y divide-line text-sm">
          <div className="py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-ink-muted">Cloud cover</dt>
              <dd className="tabular text-base font-semibold text-ink">{pct(c.clouds.total)}</dd>
            </div>
            <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-gradient-to-r from-aurora-300 to-glacier-300" style={{ width: `${Math.max(3, 100 - c.clouds.total * 100)}%` }} />
            </div>
            <p className="sr-only">{pct(1 - c.clouds.total)} clear sky</p>
          </div>
          <Row label="Aurora activity" value={auroraActivity === null ? "Unavailable" : `${auroraActivity} / 9`} />
          <Row label="Darkness" value={darknessQualityLabel(c.darkness)} />
          <Row label="Light pollution" value={lightPollutionLabel(rec.location.lightPollutionScore)} />
          <Row label="Road conditions" value={ROAD_STATUS_LABEL[rec.road.status]} tone={ROAD_TONE[rec.road.status]} />
        </dl>
      )}

      <div className="relative mt-5">
        <ReasonList reasons={rec.reasons} warnings={rec.warnings} />
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <a
          href={directionsHref(rec.location.latitude, rec.location.longitude)}
          target="_blank"
          rel="noreferrer"
          className={buttonClass({ variant: "aurora", size: "lg" })}
        >
          <Navigation aria-hidden className="h-4 w-4" />
          Directions
        </a>
        <Link href={detailHref} className={buttonClass({ variant: "glass", size: "lg" })} aria-label={`Hour-by-hour timeline for ${rec.location.name}`}>
          Timeline
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
