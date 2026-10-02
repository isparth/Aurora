"use client";

import { ArrowLeft, Car, ChevronDown, Navigation, ParkingSquare, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { MapPanel } from "@/components/map/map-panel";
import { AuroraTips } from "@/components/results/aurora-tips";
import { ReasonList } from "@/components/results/reason-list";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { ConfidenceChip } from "@/components/ui/confidence";
import { ConfidenceTip, ViewingScoreTip } from "@/components/ui/glossary";
import { SceneryBadge } from "@/components/ui/scenery-badge";
import { styleFor } from "@/components/ui/score";
import { ShareButton } from "@/components/ui/share-button";
import type { LocationDetail, ViewingLocation } from "@/domain/types";
import { directionsHref, resultsHref, type PlaceParams } from "@/lib/links";
import { planTimes } from "@/lib/plan-time";
import { opportunityLabel, scoreLabel } from "@/lib/scoring/labels";
import { formatTime } from "@/lib/time";
import { useNow } from "@/lib/use-now";

import { BeforeYouGo } from "./before-you-go";
import { ScoreBreakdown } from "./breakdown";
import { CameraCard } from "./camera-card";
import { ConditionsGrid } from "./conditions-grid";
import { PlanStrip } from "./plan-strip";
import { RoadCard } from "./road-card";
import { TimelineChart } from "./timeline-chart";

function Access({ location }: { location: ViewingLocation }) {
  const items = [
    { icon: Car, text: location.normalCarAccessible ? "Normal car" : "4×4 recommended" },
    { icon: ParkingSquare, text: location.parkingAvailable ? "Parking" : "No parking" },
    { icon: Snowflake, text: location.winterAccessible ? "Usually open in winter" : "Difficult in winter" },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted">
          <Icon aria-hidden className="h-3.5 w-3.5" />
          {text}
        </li>
      ))}
    </ul>
  );
}

export function DetailView({ detail, location, params }: { detail: LocationDetail; location: ViewingLocation; params: PlaceParams }) {
  const rec = detail.recommendation;
  const hourly = rec?.hourly ?? [];
  const defaultIndex = (() => {
    if (!rec || hourly.length === 0) return 0;
    const peak = rec.bestWindow ? hourly.findIndex((h) => h.time === rec.bestWindow!.peak) : -1;
    if (peak >= 0) return peak;
    return hourly.reduce((best, h, i) => (h.score > hourly[best].score ? i : best), 0);
  })();
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const now = useNow(detail.now, { frozen: detail.demo });
  const slot = hourly[selectedIndex];
  const backHref = detail.origin ? resultsHref({ ...params }) : "/";
  const visionEnabled = detail.dataStatus.vision.state !== "disabled";
  const plan = rec ? planTimes(rec, now) : null;
  const shareText = plan ? `Northern lights plan: ${location.name}. ${plan.leave.label} ${plan.leave.value}, best viewing ${plan.window.value}.` : location.name;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-5 pb-32 sm:px-8 lg:pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {detail.origin ? "All spots" : "Home"}
        </Link>
        <div className="flex items-center gap-3">
          {detail.demo && <span className="rounded-full border border-dusk-300/40 px-2.5 py-1 text-xs text-dusk-300">Demo data</span>}
          <Wordmark />
        </div>
      </div>

      <header className="mt-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-ink-subtle">{location.region}</p>
            <SceneryBadge scenery={location.scenery} />
          </div>
          <h1 className="mt-1 text-[2rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{location.name}</h1>
          {rec && rec.bestWindow ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="tabular text-4xl font-semibold tracking-tight">
                {rec.viewingScore}
                <span className="text-xl text-ink-subtle"> / 100</span>
              </span>
              <span className={`flex items-center text-lg font-medium ${styleFor(rec.viewingScore).text}`}>
                {opportunityLabel(rec.viewingScore)} tonight
                <ViewingScoreTip />
              </span>
            </p>
          ) : (
            <p className="mt-3 text-lg text-ink-muted">{rec ? "No reachable viewing window tonight." : "Forecast unavailable for tonight."}</p>
          )}
          {rec?.bestWindow && (
            <div className="mt-3 flex items-center">
              <ConfidenceChip value={rec.confidence} />
              <ConfidenceTip />
            </div>
          )}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <ShareButton title={`Aurora · ${location.name}`} text={shareText} className="border border-line" />
          <a href={directionsHref(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className={buttonClass({ variant: "aurora", size: "lg" })}>
            <Navigation aria-hidden className="h-4 w-4" />
            Directions
          </a>
        </div>
      </header>

      {detail.notices.length > 0 && (
        <ul className="mt-6 space-y-2">
          {detail.notices.map((n) => (
            <li key={n} className="rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2.5 text-sm text-warn">
              {n}
            </li>
          ))}
        </ul>
      )}

      {rec && (
        <div className="mt-6">
          <PlanStrip rec={rec} now={now} hasOrigin={Boolean(detail.origin)} />
          <ShareButton title={`Aurora · ${location.name}`} text={shareText} className="mt-2 -ml-3 lg:hidden" />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          {rec && slot && (
            <section aria-labelledby="timeline-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="timeline-title" className="text-sm font-semibold">
                  Tonight, hour by hour
                </h2>
                <p className="tabular text-sm text-ink-muted" aria-live="polite">
                  {formatTime(slot.time)} · <span className="font-semibold text-ink">{slot.score}</span> / 100 · {scoreLabel(slot.score)}
                  {!slot.reachable && " · before you could arrive"}
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-line bg-surface p-4 pt-5">
                <TimelineChart hourly={hourly} bestWindow={rec.bestWindow} earliestArrival={rec.earliestArrival} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
              </div>
              <p className="mt-2 text-xs text-ink-subtle">Tap a time (or use the arrow keys) to see its conditions below. Times are Iceland time.</p>
            </section>
          )}

          {rec && slot && (
            <section aria-labelledby="conditions-title">
              <h2 id="conditions-title" className="text-sm font-semibold">
                Conditions at {formatTime(slot.time)}
              </h2>
              <div className="mt-3">
                <ConditionsGrid c={slot.conditions} moon={detail.moon} road={rec.road} location={location} />
              </div>
              <details className="group mt-4 rounded-xl border border-line px-4 py-3">
                <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-sm text-ink-muted marker:hidden hover:text-ink">
                  How the {slot.score} at {formatTime(slot.time)} is calculated
                  <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-3 pb-1">
                  <ScoreBreakdown components={slot.components} cameraObserved={Boolean(rec.camera?.observation?.usable)} />
                </div>
              </details>
            </section>
          )}

          {rec && rec.bestWindow && <BeforeYouGo rec={rec} location={location} />}

          {rec && rec.bestWindow && (
            <section aria-labelledby="why-title" className="rounded-2xl border border-line bg-surface p-5">
              <h2 id="why-title" className="sr-only">
                Why this place
              </h2>
              <ReasonList reasons={rec.reasons} warnings={rec.warnings} title="Why this place?" />
            </section>
          )}

          <section aria-labelledby="about-title">
            <h2 id="about-title" className="text-sm font-semibold">
              About this spot
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{location.description}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">Setting:</span> {location.highlight}.
            </p>
            {location.notes && <p className="mt-2 text-sm leading-relaxed text-warn">{location.notes}</p>}
            <Access location={location} />
          </section>

          <AuroraTips />
        </div>

        <aside className="min-w-0 space-y-6">
          <div className="h-64 overflow-hidden rounded-2xl border border-line">
            <MapPanel
              origin={detail.origin ?? { lat: location.latitude, lon: location.longitude, label: location.name }}
              destinations={[{ id: location.id, name: location.name, lat: location.latitude, lon: location.longitude, score: rec?.viewingScore ?? 0, rank: null, recommended: rec?.recommended ?? true }]}
              selectedId={location.id}
              route={rec?.travel.geometry}
              camera={rec?.camera ? { lat: rec.camera.camera.latitude, lon: rec.camera.camera.longitude, name: rec.camera.camera.name } : null}
            />
          </div>
          {rec && <RoadCard road={rec.road} />}
          <CameraCard camera={rec?.camera} now={detail.now} visionEnabled={visionEnabled} />
        </aside>
      </div>

      <SiteFooter className="mt-12" />

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night-950/90 px-4 pt-3 backdrop-blur-xl lg:hidden">
        <a
          href={directionsHref(location.latitude, location.longitude)}
          target="_blank"
          rel="noreferrer"
          className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 rounded-xl bg-aurora-300 px-4 text-night-950"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Directions to {location.name}</span>
            {plan && rec?.bestWindow && (
              <span className="block text-xs opacity-80">
                {detail.origin ? `${plan.leave.label} ${plan.leave.value}${plan.leave.sub ? ` · ${plan.leave.sub}` : ""}` : `Best ${plan.window.value}`}
              </span>
            )}
          </span>
          <Navigation aria-hidden className="h-5 w-5 shrink-0" />
        </a>
      </div>
    </div>
  );
}
