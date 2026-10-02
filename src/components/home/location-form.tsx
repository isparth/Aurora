"use client";

import { ArrowRight, Crosshair, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { buttonClass } from "@/components/ui/button";
import type { PlaceSuggestion } from "@/features/geocoding/search";
import { resultsHref } from "@/lib/links";

import { LocationCombobox } from "./location-combobox";

const REYKJAVIK: PlaceSuggestion = {
  id: "town:reykjavik",
  name: "Reykjavík",
  detail: "Capital Region",
  lat: 64.1466,
  lon: -21.9426,
  kind: "town",
};

function geolocationMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access is blocked. Allow it for this site in your browser settings, or search for a place below.";
    case error.TIMEOUT:
      return "Finding your position took too long. Try again, or search for a place below.";
    default:
      return "We couldn't determine your position. Search for a place below instead.";
  }
}

export function LocationForm({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceSuggestion | null>(REYKJAVIK);
  const [formError, setFormError] = useState<string | null>(null);
  const busy = locating || isNavigating;

  const go = (href: string) => startTransition(() => router.push(href));

  const useMyLocation = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("This browser can't share its location. Search for a place below instead.");
      return;
    }
    if (!window.isSecureContext) {
      setGeoError("Location needs a secure (https) connection. Search for a place below instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        go(resultsHref({ lat: position.coords.latitude, lon: position.coords.longitude }));
      },
      (error) => {
        setLocating(false);
        setGeoError(geolocationMessage(error));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!place) {
      setFormError("Choose a place from the suggestions, or use your current location.");
      return;
    }
    setFormError(null);
    go(resultsHref({ lat: place.lat, lon: place.lon, label: place.name }));
  };

  return (
    <div className={className} aria-busy={busy}>
      <h2 className="text-sm font-medium text-ink-muted">Where are you?</h2>

      <button type="button" onClick={useMyLocation} disabled={busy} className={buttonClass({ variant: "primary", size: "lg", block: true, className: "mt-3" })}>
        {locating ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Crosshair aria-hidden className="h-5 w-5" />}
        {locating ? "Finding your position…" : "Use my current location"}
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
          Search for your location
        </label>
        <LocationCombobox value={place} onChange={(p) => { setPlace(p); if (p) setFormError(null); }} disabled={busy} invalid={!!formError} describedBy={formError ? "location-error" : undefined} />
        {formError && (
          <p id="location-error" role="alert" className="mt-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonClass({ variant: "glass", size: "lg", block: true, className: "mt-3" })}>
          {isNavigating ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : null}
          {isNavigating ? "Checking skies, clouds and roads…" : "Find the Northern Lights"}
          {!isNavigating && <ArrowRight aria-hidden className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Just exploring?{" "}
        <Link href={resultsHref({ demo: true })} className="text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          See a demo night near Reykjavík
        </Link>
      </p>
    </div>
  );
}
