"use client";

import { ArrowLeft, Car, Navigation, ParkingSquare, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { MapPanel } from "@/components/map/map-panel";
import { ReasonList } from "@/components/results/reason-list";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { ConfidenceChip } from "@/components/ui/confidence";
import { styleFor } from "@/components/ui/score";
import type { LocationDetail, ViewingLocation } from "@/domain/types";
import { distanceText, driveText, leaveText, windowText } from "@/lib/format";
import { directionsHref, resultsHref, type PlaceParams } from "@/lib/links";
import { opportunityLabel, scoreLabel } from "@/lib/scoring/labels";
import { formatTime } from "@/lib/time";

import { ScoreBreakdown } from "./breakdown";
import { CameraCard } from "./camera-card";
import { ConditionsGrid } from "./conditions-grid";
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
  const slot = hourly[selectedIndex];
  const backHref = detail.origin ? resultsHref({ ...params }) : "/";
  const visionEnabled = detail.dataStatus.vision.state !== "disabled";

  return (
    <div className="mx-auto max-w-5xl px-5 pt-5 pb-32 sm:px-8 lg:pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {detail.origin ? "All spots" : "Home"}
        </Link>
        <div className="flex items-center gap-3">
          {detail.demo && <span className="rounded-full border border-dusk-300/40 px-2.5 py-1 text-xs text-dusk-300">Demo data</span>}
          <Wordmark />
        </div>
      </div>

      <header className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm text-ink-subtle">{location.region}</p>
          <h1 className="mt-1 text-[2rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{location.name}</h1>
          {rec && rec.bestWindow ? (
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular text-5xl font-semibold tracking-tight">
                {rec.viewingScore}
                <span className="text-2xl text-ink-subtle"> / 100</span>
              </span>
              <span className={`text-lg font-medium ${styleFor(rec.viewingScore).text}`}>{opportunityLabel(rec.viewingScore)} tonight</span>
            </p>
          ) : (
            <p className="mt-3 text-lg text-ink-muted">{rec ? "No reachable viewing window tonight." : "Forecast unavailable for tonight."}</p>
          )}
          {rec?.bestWindow && <ConfidenceChip value={rec.confidence} className="mt-3" />}
        </div>
        <div className="hidden lg:block">
          <a href={directionsHref(location.latitude, location.longitude)} target="_blank" rel="noreferrer" className={buttonClass({ variant: "aurora", size: "lg" })}>
            <Navigation aria-hidden className="h-4 w-4" />
            Open directions
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
        <dl className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-surface p-4 whitespace-nowrap sm:p-5">
          <div>
            <dt className="text-xs text-ink-subtle">{detail.origin ? "Drive" : "Travel"}</dt>
            <dd className="tabular mt-1 font-semibold">{detail.origin ? driveText(rec.travel).replace(" drive", "") : "—"}</dd>
            {detail.origin && <dd className="text-xs text-ink-subtle">{distanceText(rec.travel)}</dd>}
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Best viewing</dt>
            <dd className="tabular mt-1 font-semibold">{windowText(rec.bestWindow)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">{detail.origin ? "Leave" : "Be there by"}</dt>
            <dd className="tabular mt-1 font-semibold text-aurora-300">
              {detail.origin ? leaveText(rec).replace("Leave around ", "") : rec.bestWindow ? formatTime(rec.bestWindow.start) : "—"}
            </dd>
          </div>
        </dl>
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
              <p className="mt-2 text-xs text-ink-subtle">Tap or use the arrow keys to inspect a time. Times are Iceland time.</p>
            </section>
          )}

          {rec && slot && (
            <section aria-labelledby="conditions-title">
              <h2 id="conditions-title" className="text-sm font-semibold">
                Conditions at {formatTime(slot.time)}
              </h2>
              <div className="mt-3 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <ScoreBreakdown components={slot.components} cameraObserved={Boolean(rec.camera?.observation?.usable)} />
                <ConditionsGrid c={slot.conditions} moon={detail.moon} road={rec.road} location={location} />
              </div>
            </section>
          )}

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
            {location.notes && <p className="mt-2 text-sm leading-relaxed text-warn">{location.notes}</p>}
            <Access location={location} />
          </section>
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
            <span className="block truncate text-sm font-semibold">Open directions</span>
            {rec?.bestWindow && <span className="block text-xs opacity-80">{detail.origin ? leaveText(rec) : `Best ${windowText(rec.bestWindow)}`}</span>}
          </span>
          <Navigation aria-hidden className="h-5 w-5 shrink-0" />
        </a>
      </div>
    </div>
  );
}
