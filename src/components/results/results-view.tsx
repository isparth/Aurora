"use client";

import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import type { MapDestination } from "@/components/map/aurora-map";
import { MapPanel } from "@/components/map/map-panel";
import { MapSelectionCard } from "@/components/map/map-selection-card";
import { SiteFooter } from "@/components/site-footer";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { RecommendationResponse, TravelMode } from "@/domain/types";
import { TRAVEL_MODES } from "@/features/recommendations/travel-modes";
import { directionsHref, locationHref, resultsHref, type PlaceParams } from "@/lib/links";
import { planTimes } from "@/lib/plan-time";
import { MINUTE } from "@/lib/time";
import { useMediaQuery } from "@/lib/use-media-query";
import { useNow } from "@/lib/use-now";

import { AuroraTips } from "./aurora-tips";
import { BestCard } from "./best-card";
import { DataSources, Notices } from "./data-sources";
import { EmptyState } from "./empty-state";
import { NotRecommendedList, RankedList } from "./ranked-list";
import { VerdictHeader } from "./verdict-header";
import { WiderOptionCard } from "./wider-option";

const MODE_OPTIONS = (Object.keys(TRAVEL_MODES) as TravelMode[]).map((value) => ({ value, label: TRAVEL_MODES[value].label, hint: TRAVEL_MODES[value].hint }));
/** Forecasts and roads change; results older than this are refreshed when you come back to the page. */
const STALE_AFTER = 10 * MINUTE;

export function ResultsView({ data, params }: { data: RecommendationResponse; params: PlaceParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [pendingMode, setPendingMode] = useState<TravelMode | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(data.recommendations[0]?.location.id ?? null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const now = useNow(data.now, { frozen: data.demo });
  const viewToggleRef = useRef<HTMLDivElement>(null);

  const bestWindowEnd = data.recommendations[0]?.bestWindow?.end;
  const lastRefreshRef = useRef(0);
  const refresh = () => {
    lastRefreshRef.current = Date.now();
    startRefresh(() => router.refresh());
  };
  useEffect(() => {
    if (data.demo || pending) return;
    const refreshIfStale = () => {
      // At most one automatic refresh every couple of minutes, and only while the page is on screen.
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshRef.current < 2 * MINUTE) return;
      const age = Date.now() - Date.parse(data.generatedAt);
      const windowOver = bestWindowEnd !== undefined && Date.now() > Date.parse(bestWindowEnd) && age > MINUTE;
      if (age > STALE_AFTER || windowOver) {
        lastRefreshRef.current = Date.now();
        startRefresh(() => router.refresh());
      }
    };
    document.addEventListener("visibilitychange", refreshIfStale);
    const id = setInterval(refreshIfStale, MINUTE);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      clearInterval(id);
    };
  }, [data.generatedAt, data.demo, router, bestWindowEnd, pending]);

  const best = data.recommendations[0];
  const others = data.recommendations.slice(1);
  const outsideCoverage = data.emptyReason === "outside-coverage";
  const hrefFor = (id: string) => locationHref(id, params);
  const all = [...data.recommendations, ...data.notRecommended];
  const selected = all.find((r) => r.location.id === selectedId) ?? best ?? all[0];

  const destinations = useMemo<MapDestination[]>(
    () =>
      [...data.recommendations, ...data.notRecommended].map((r) => ({
        id: r.location.id,
        name: r.location.name,
        lat: r.location.latitude,
        lon: r.location.longitude,
        score: r.viewingScore,
        rank: r.recommended ? r.rank : null,
        recommended: r.recommended,
      })),
    [data],
  );

  const changeMode = (mode: TravelMode) => {
    setPendingMode(mode);
    startTransition(() => router.push(resultsHref({ ...params, mode }), { scroll: false }));
  };

  const map =
    destinations.length > 0 ? (
      <MapPanel
        origin={data.origin}
        destinations={destinations}
        selectedId={selected?.location.id ?? null}
        onSelect={setSelectedId}
        route={selected?.travel.geometry}
        camera={selected?.camera ? { lat: selected.camera.camera.latitude, lon: selected.camera.camera.longitude, name: selected.camera.camera.name } : null}
        insetBottom={130}
      />
    ) : null;
  const selectionCard = selected ? <MapSelectionCard rec={selected} detailHref={hrefFor(selected.location.id)} /> : null;
  const wider = data.widerOption ? <WiderOptionCard option={data.widerOption} onWiden={changeMode} pending={pending} /> : null;
  const sticky = best ? planTimes(best, now).leave : null;

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(440px,540px)_1fr]">
      <div className="lg:overflow-y-auto">
        <div className="mx-auto max-w-xl px-5 pt-5 pb-32 sm:px-8 lg:pb-12">
          <div className="flex items-center justify-between gap-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              {data.demo && <span className="rounded-full border border-dusk-300/40 px-2.5 py-1 text-xs text-dusk-300">Demo data</span>}
              <Link href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
                <MapPin aria-hidden className="h-4 w-4" />
                Change<span className="sr-only"> location</span>
              </Link>
            </div>
          </div>

          <div className="mt-7">
            <VerdictHeader data={data} now={now} onRefresh={refresh} refreshing={refreshing} />
          </div>

          {!outsideCoverage && (
            <div className="mt-5">
              <p id="drive-label" className="mb-1.5 text-xs text-ink-subtle">
                How far will you drive?
              </p>
              <SegmentedControl
                label="How far will you drive?"
                options={MODE_OPTIONS}
                value={pendingMode ?? data.travelMode}
                onChange={changeMode}
                activateOnArrow={false}
              />
              <p className="sr-only" aria-live="polite">
                {pending ? "Updating recommendations…" : ""}
              </p>
            </div>
          )}

          {data.notices.length > 0 && (
            <div className="mt-5">
              <Notices notices={data.notices} />
            </div>
          )}

          {map && (
            <div ref={viewToggleRef} className="mt-5 scroll-mt-3 lg:hidden">
              <SegmentedControl
                label="Show results as"
                options={[
                  { value: "list", label: "List" },
                  { value: "map", label: "Map" },
                ]}
                value={view}
                onChange={(v) => {
                  setView(v);
                  if (v === "map") requestAnimationFrame(() => viewToggleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
              />
            </div>
          )}

          <div className={`mt-5 space-y-5 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`} aria-busy={pending}>
            {!isDesktop && view === "map" && map ? (
              <div className="relative h-[64dvh] overflow-hidden rounded-2xl border border-line">
                {map}
                <div className="pointer-events-none absolute inset-x-3 bottom-8">{selectionCard}</div>
              </div>
            ) : best ? (
              <>
                {best.label === "Poor" && wider}
                <BestCard rec={best} detailHref={hrefFor(best.location.id)} auroraActivity={data.aurora.activity} now={now} />
                {best.label !== "Poor" && wider}
                <RankedList items={others} hrefFor={hrefFor} selectedId={selectedId} onHighlight={setSelectedId} />
                <NotRecommendedList items={data.notRecommended} hrefFor={hrefFor} />
                <AuroraTips />
              </>
            ) : (
              <>
                {wider}
                {data.notRecommended.length > 0 ? (
                  <NotRecommendedList items={data.notRecommended} hrefFor={hrefFor} />
                ) : (
                  <EmptyState reason={data.emptyReason ?? "no-candidates"} params={params} travelMode={data.travelMode} />
                )}
              </>
            )}
          </div>

          {!outsideCoverage && <DataSources status={data.dataStatus} />}
          <SiteFooter className="mt-8" />
        </div>
      </div>

      {map && (
        <div className="relative hidden h-dvh border-l border-line lg:block">
          {isDesktop && map}
          {isDesktop && <div className="pointer-events-none absolute bottom-8 left-4 w-80">{selectionCard}</div>}
        </div>
      )}

      {best && sticky && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night-950/90 px-4 pt-3 backdrop-blur-xl lg:hidden">
          <a
            href={directionsHref(best.location.latitude, best.location.longitude)}
            target="_blank"
            rel="noreferrer"
            className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 rounded-xl bg-aurora-300 px-4 text-night-950"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Directions to {best.location.name}</span>
              <span className="block text-xs opacity-80">
                {sticky.label} {sticky.value}
                {sticky.sub ? ` · ${sticky.sub}` : ""}
              </span>
            </span>
            <Navigation aria-hidden className="h-5 w-5 shrink-0" />
          </a>
        </div>
      )}
    </div>
  );
}
