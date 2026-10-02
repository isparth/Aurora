"use client";

import { ArrowRight, Crosshair, History, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { buttonClass } from "@/components/ui/button";
import { TOWNS } from "@/data/towns";
import type { PlaceSuggestion } from "@/features/geocoding/search";
import { resultsHref } from "@/lib/links";
import { saveRecentPlace, useRecentPlaces, type RecentPlace } from "@/lib/recent-places";

import { LocationCombobox } from "./location-combobox";

/** Where most visitors start an aurora evening from. */
const POPULAR = ["Reykjavík", "Keflavík Airport", "Selfoss", "Vík", "Akureyri", "Höfn"].flatMap((name) => TOWNS.filter((t) => t.name === name));

function geolocationMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access is blocked. Allow it for this site in your browser settings, or pick a place below.";
    case error.TIMEOUT:
      return "Finding your position took too long. Try again, or pick a place below.";
    default:
      return "We couldn't determine your position. Pick a place below instead.";
  }
}

const chipClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60";

export function LocationForm({ className = "" }: { className?: string }) {
  const router = useRouter();
  const recent = useRecentPlaces();
  const [isNavigating, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const busy = locating || resolving || isNavigating;

  const goTo = (place: RecentPlace) => {
    setFormError(null);
    setPendingName(place.name);
    saveRecentPlace({ name: place.name, lat: place.lat, lon: place.lon });
    startTransition(() => router.push(resultsHref({ lat: place.lat, lon: place.lon, label: place.name })));
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) return setGeoError("This browser can't share its location. Pick a place below instead.");
    if (!window.isSecureContext) return setGeoError("Location needs a secure (https) connection. Pick a place below instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setPendingName("__gps");
        startTransition(() => router.push(resultsHref({ lat: position.coords.latitude, lon: position.coords.longitude })));
      },
      (error) => {
        setLocating(false);
        setGeoError(geolocationMessage(error));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  };

  /** Typed but didn't pick a suggestion? Use the best match rather than making them choose. */
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q.length < 2) return setFormError("Type a town, hotel or place in Iceland — or use your current location.");
    setResolving(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const first = res.ok ? ((await res.json()) as { results?: PlaceSuggestion[] }).results?.[0] : undefined;
      if (first) goTo(first);
      else setFormError(`We couldn't find “${q}” in Iceland. Try a nearby town.`);
    } catch {
      setFormError("Search isn't available right now. Pick a starting point below, or use your current location.");
    } finally {
      setResolving(false);
    }
  };

  const chip = (place: RecentPlace, icon: "recent" | "popular") => {
    const Icon = icon === "recent" ? History : MapPin;
    return (
      <button key={`${icon}-${place.name}`} type="button" disabled={busy} onClick={() => goTo(place)} className={chipClass}>
        {isNavigating && pendingName === place.name ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Icon aria-hidden className="h-3.5 w-3.5" />}
        {place.name}
      </button>
    );
  };

  return (
    <div className={className} aria-busy={busy}>
      <h2 className="text-sm font-medium text-ink-muted">Where are you?</h2>

      <button type="button" onClick={useMyLocation} disabled={busy} className={buttonClass({ variant: "primary", size: "lg", block: true, className: "mt-3" })}>
        {locating || (isNavigating && pendingName === "__gps") ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Crosshair aria-hidden className="h-5 w-5" />}
        {locating ? "Finding your position…" : isNavigating && pendingName === "__gps" ? "Checking skies near you…" : "Use my current location"}
      </button>
      {geoError && (
        <p role="alert" className="mt-3 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-sm text-warn">
          {geoError}
        </p>
      )}

      <div className="my-6 flex items-center gap-4 text-xs tracking-[0.2em] text-ink-subtle uppercase" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="location-input" className="sr-only">
          Search for where you are
        </label>
        <LocationCombobox
          value={null}
          onChange={(p) => p && goTo(p)}
          disabled={busy}
          invalid={!!formError}
          describedBy={formError ? "location-error" : undefined}
        />
        {formError && (
          <p id="location-error" role="alert" className="mt-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonClass({ variant: "glass", size: "lg", block: true, className: "mt-3" })}>
          {resolving || (isNavigating && pendingName !== "__gps") ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : null}
          {resolving || (isNavigating && pendingName !== "__gps") ? "Checking skies, clouds and roads…" : "Find the Northern Lights"}
          {!resolving && !isNavigating && <ArrowRight aria-hidden className="h-4 w-4" />}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs text-ink-subtle">Recent</h3>
          <div className="mt-2 flex flex-wrap gap-2">{recent.map((p) => chip(p, "recent"))}</div>
        </div>
      )}
      <div className="mt-6">
        <h3 className="text-xs text-ink-subtle">Popular starting points</h3>
        <div className="mt-2 flex flex-wrap gap-2">{POPULAR.filter((p) => !recent.some((r) => r.name === p.name)).map((p) => chip(p, "popular"))}</div>
      </div>

      <p className="mt-6 text-sm text-ink-subtle">
        Just exploring?{" "}
        <Link href={resultsHref({ demo: true })} className="text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          See a demo night near Reykjavík
        </Link>
      </p>
    </div>
  );
}
