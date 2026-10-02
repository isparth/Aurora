"use client";

import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import type { MapDestination } from "@/components/map/aurora-map";
import { MapPanel } from "@/components/map/map-panel";
import { SiteFooter } from "@/components/site-footer";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { RecommendationResponse, TravelMode } from "@/domain/types";
import { TRAVEL_MODES } from "@/features/recommendations/travel-modes";
import { leaveText } from "@/lib/format";
import { directionsHref, locationHref, resultsHref, type PlaceParams } from "@/lib/links";
import { useMediaQuery } from "@/lib/use-media-query";

import { BestCard } from "./best-card";
import { DataSources, Notices } from "./data-sources";
import { EmptyState } from "./empty-state";
import { NotRecommendedList, RankedList } from "./ranked-list";
import { TonightHeader } from "./tonight-header";

const MODE_OPTIONS = (Object.keys(TRAVEL_MODES) as TravelMode[]).map((value) => ({ value, label: TRAVEL_MODES[value].label, hint: TRAVEL_MODES[value].hint }));

export function ResultsView({ data, params }: { data: RecommendationResponse; params: PlaceParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<TravelMode | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(data.recommendations[0]?.location.id ?? null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const best = data.recommendations[0];
  const others = data.recommendations.slice(1);
  const outsideCoverage = data.emptyReason === "outside-coverage";
  const hrefFor = (id: string) => locationHref(id, params);
  const selected = [...data.recommendations, ...data.notRecommended].find((r) => r.location.id === selectedId) ?? best;

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

  const showMap = destinations.length > 0;
  const map = showMap ? (
    <MapPanel
      origin={data.origin}
      destinations={destinations}
      selectedId={selected?.location.id ?? null}
      onSelect={setSelectedId}
      route={selected?.travel.geometry}
      camera={selected?.camera ? { lat: selected.camera.camera.latitude, lon: selected.camera.camera.longitude, name: selected.camera.camera.name } : null}
    />
  ) : null;

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(440px,540px)_1fr]">
      <div className="lg:overflow-y-auto">
        <div className="mx-auto max-w-xl px-5 pt-5 pb-32 sm:px-8 lg:pb-12">
          <div className="flex items-center justify-between gap-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              {data.demo && <span className="rounded-full border border-dusk-300/40 px-2.5 py-1 text-xs text-dusk-300">Demo data</span>}
              <Link href="/" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-muted hover:bg-white/5 hover:text-ink">
                <MapPin aria-hidden className="h-4 w-4" />
                Change
              </Link>
            </div>
          </div>

          {outsideCoverage ? (
            <h1 className="mt-8 text-[1.75rem] leading-tight font-semibold tracking-tight">Outside Iceland</h1>
          ) : (
            <>
              <div className="mt-8">
                <TonightHeader data={data} />
              </div>
              <div className="mt-5">
                <SegmentedControl label="How far are you willing to drive?" options={MODE_OPTIONS} value={pendingMode ?? data.travelMode} onChange={changeMode} />
                <p className="sr-only" aria-live="polite">
                  {pending ? "Updating recommendations…" : ""}
                </p>
              </div>
            </>
          )}

          {data.notices.length > 0 && (
            <div className="mt-5">
              <Notices notices={data.notices} />
            </div>
          )}

          {showMap && (
            <div className="mt-5 lg:hidden">
              <SegmentedControl
                label="Show results as"
                options={[
                  { value: "list", label: "List" },
                  { value: "map", label: "Map" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          )}

          <div className={`mt-5 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`} aria-busy={pending}>
            {!isDesktop && view === "map" && map ? (
              <div className="h-[62dvh] overflow-hidden rounded-2xl border border-line">{map}</div>
            ) : best ? (
              <>
                <BestCard rec={best} detailHref={hrefFor(best.location.id)} auroraActivity={data.aurora.activity} />
                <RankedList items={others} hrefFor={hrefFor} selectedId={selectedId} onHighlight={setSelectedId} />
                <NotRecommendedList items={data.notRecommended} hrefFor={hrefFor} />
              </>
            ) : data.notRecommended.length > 0 ? (
              <NotRecommendedList items={data.notRecommended} hrefFor={hrefFor} />
            ) : (
              <EmptyState reason={data.emptyReason ?? "no-candidates"} params={params} travelMode={data.travelMode} />
            )}
          </div>

          {!outsideCoverage && <DataSources status={data.dataStatus} />}
          <SiteFooter className="mt-8" />
        </div>
      </div>

      {map && <div className="relative hidden h-dvh border-l border-line lg:block">{isDesktop && map}</div>}

      {best && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night-950/90 px-4 pt-3 backdrop-blur-xl lg:hidden">
          <a
            href={directionsHref(best.location.latitude, best.location.longitude)}
            target="_blank"
            rel="noreferrer"
            className="mx-auto flex min-h-14 max-w-xl items-center justify-between gap-3 rounded-xl bg-aurora-300 px-4 text-night-950"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Directions to {best.location.name}</span>
              <span className="block text-xs opacity-80">{leaveText(best)}</span>
            </span>
            <Navigation aria-hidden className="h-5 w-5 shrink-0" />
          </a>
        </div>
      )}
    </div>
  );
}
