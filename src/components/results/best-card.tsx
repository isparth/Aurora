import { ArrowRight, Car, Navigation } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { ConfidenceChip } from "@/components/ui/confidence";
import { ConfidenceTip, ViewingScoreTip } from "@/components/ui/glossary";
import { LABEL_STYLE } from "@/components/ui/score";
import { ShareButton } from "@/components/ui/share-button";
import type { Recommendation } from "@/domain/types";
import { activityWord, distanceText, pct, ROAD_TONE } from "@/lib/format";
import { directionsHref } from "@/lib/links";
import { planTimes } from "@/lib/plan-time";
import { darknessQualityLabel, lightPollutionLabel, ROAD_STATUS_LABEL, scoreLabel } from "@/lib/scoring/labels";
import { formatDuration } from "@/lib/time";

import { NightCurve } from "./night-curve";
import { ReasonList } from "./reason-list";

function ScoreRing({ score }: { score: number }) {
  const label = scoreLabel(score);
  const c = 2 * Math.PI * 44;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="7" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={LABEL_STYLE[label].stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} />
        </svg>
        <span className="tabular absolute inset-0 flex items-center justify-center text-[1.35rem] font-semibold">{score}</span>
      </div>
      <span className={`mt-1 flex items-center text-xs font-semibold ${LABEL_STYLE[label].text}`}>
        {label}
        <ViewingScoreTip align="end" />
      </span>
      <span className="sr-only">Viewing score {score} out of 100</span>
    </div>
  );
}

function Row({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular text-right font-medium ${tone}`}>{value}</dd>
    </div>
  );
}

export function BestCard({ rec, detailHref, auroraActivity, now }: { rec: Recommendation; detailHref: string; auroraActivity: number | null; now: number }) {
  const c = rec.conditions;
  const { leave, window } = planTimes(rec, now);
  const shareText = `Northern lights plan: ${rec.location.name}. ${leave.label} ${leave.value}, best viewing ${window.value}.`;

  return (
    <article aria-labelledby="best-title" className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white/[0.07] to-white/[0.015] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-28 -right-20 h-64 w-64 rounded-full bg-aurora-400/14 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-aurora-300 uppercase">Best tonight</p>
          <h2 id="best-title" className="mt-2 text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">
            {rec.location.name}
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">{rec.location.region}</p>
        </div>
        <ScoreRing score={rec.viewingScore} />
      </div>

      <dl className="relative mt-5 grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className={`p-3.5 ${leave.urgent ? "bg-aurora-300/12" : "bg-night-900/90"}`}>
          <dt className="text-xs text-ink-subtle">{leave.label}</dt>
          <dd className="tabular mt-1 text-2xl leading-tight font-semibold text-aurora-300">{leave.value}</dd>
          {leave.sub && <dd className="mt-0.5 text-xs text-ink-muted">{leave.sub}</dd>}
        </div>
        <div className="bg-night-900/90 p-3.5">
          <dt className="text-xs text-ink-subtle">Best viewing</dt>
          <dd className="tabular mt-1 text-2xl leading-tight font-semibold whitespace-nowrap text-ink">{window.value}</dd>
          {window.sub && <dd className="mt-0.5 text-xs text-ink-muted">{window.sub}</dd>}
        </div>
        <div className="col-span-2 flex items-center gap-2 bg-night-900/90 px-3.5 py-2.5 text-sm">
          <Car aria-hidden className="h-4 w-4 text-ink-subtle" />
          <dt className="sr-only">Drive</dt>
          <dd className="tabular text-ink">
            {rec.travel.durationMinutes === 0 ? "No drive needed" : `${formatDuration(rec.travel.durationMinutes)} drive`}
            <span className="text-ink-subtle"> · {distanceText(rec.travel)}</span>
          </dd>
        </div>
      </dl>

      <div className="relative mt-4">
        <NightCurve rec={rec} now={now} />
      </div>

      <div className="relative mt-4 grid gap-2">
        <a href={directionsHref(rec.location.latitude, rec.location.longitude)} target="_blank" rel="noreferrer" className={buttonClass({ variant: "aurora", size: "lg", block: true })}>
          <Navigation aria-hidden className="h-4 w-4" />
          Directions
        </a>
        <div className="grid grid-cols-2 gap-2">
          <Link href={detailHref} className={buttonClass({ variant: "glass", size: "md" })}>
            Hour by hour
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <ShareButton title={`Aurora · ${rec.location.name}`} text={shareText} className="border border-line" />
        </div>
      </div>

      {c && (
        <dl className="relative mt-5 divide-y divide-line border-t border-line text-sm">
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
          <Row label="Aurora activity" value={auroraActivity === null ? "Unavailable" : `${auroraActivity}/9 · ${activityWord(auroraActivity)}`} />
          <Row label="Darkness" value={darknessQualityLabel(c.darkness)} />
          <Row label="Light pollution" value={lightPollutionLabel(rec.location.lightPollutionScore)} />
          <Row label="Road conditions" value={ROAD_STATUS_LABEL[rec.road.status]} tone={ROAD_TONE[rec.road.status]} />
        </dl>
      )}

      <div className="relative mt-4">
        <ReasonList reasons={rec.reasons} warnings={rec.warnings} />
      </div>

      <div className="relative mt-5 flex items-center">
        <ConfidenceChip value={rec.confidence} />
        <ConfidenceTip align="start" />
      </div>
    </article>
  );
}
