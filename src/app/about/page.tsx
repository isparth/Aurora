import type { Metadata } from "next";
import Link from "next/link";

import { SkyBackground } from "@/components/brand/sky-background";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClass } from "@/components/ui/button";
import { VIEWING_WEIGHTS } from "@/lib/scoring/viewing-score";

export const metadata: Metadata = { title: "How it works & data sources" };

const WEIGHT_ROWS: { key: keyof typeof VIEWING_WEIGHTS; label: string; detail: string }[] = [
  { key: "clouds", label: "Clear sky", detail: "Low, mid and high cloud from Open-Meteo. Thick cloud also caps the whole score — aurora is invisible through overcast." },
  { key: "aurora", label: "Aurora activity", detail: "The Icelandic Meteorological Office's 0–9 activity forecast, with a gentle peak around magnetic midnight." },
  { key: "darkness", label: "Darkness", detail: "Sun altitude at each destination (civil → astronomical twilight), plus a modest moonlight penalty." },
  { key: "lightPollution", label: "Light pollution", detail: "A per-site estimate from distance to towns. 0 = urban glow, 1 = extremely dark." },
  { key: "weather", label: "Weather quality", detail: "Precipitation, visibility and wind." },
  { key: "camera", label: "Camera evidence", detail: "Optional AI reading of a nearby road camera. Seeing aurora is strong evidence; not seeing it never lowers the score." },
];

const SOURCES = [
  {
    name: "Icelandic Meteorological Office (Veðurstofa Íslands)",
    use: "Aurora activity forecast (0–9) for each night, via the official XML service.",
    href: "https://en.vedur.is/weather/forecasts/aurora/",
  },
  {
    name: "Icelandic Road and Coastal Administration (Vegagerðin)",
    use: "Road conditions (færð data service and snow-clearing route geometry) and road webcams. Licensed CC BY 4.0; retrieval times are shown with each result. This app is not endorsed by IRCA.",
    href: "https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur/terms-and-conditions",
  },
  { name: "Open-Meteo", use: "Hourly cloud layers, temperature, precipitation, visibility and wind (CC BY 4.0).", href: "https://open-meteo.com/" },
  { name: "OSRM / OpenStreetMap", use: "Driving routes and times (ODbL). Mapbox is used instead when a token is configured.", href: "https://project-osrm.org/" },
  { name: "OpenFreeMap, OpenMapTiles & OpenStreetMap contributors", use: "Base map tiles.", href: "https://openfreemap.org/" },
  { name: "Photon by komoot", use: "Place search (OpenStreetMap data).", href: "https://photon.komoot.io/" },
];

export default function AboutPage() {
  return (
    <main className="relative min-h-dvh">
      <SkyBackground intensity="subtle" />
      <div className="mx-auto max-w-2xl px-6 pt-6 pb-16">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">How Aurora decides</h1>
        <p className="mt-3 leading-relaxed text-ink-muted">
          Aurora scores every curated viewing spot near you for every half hour of tonight — location × time — and only then decides where
          to send you. A spot whose clear spell ends before you could get there doesn&apos;t count.
        </p>

        <section className="mt-10" aria-labelledby="viewing-title">
          <h2 id="viewing-title" className="text-lg font-semibold">
            1 · Viewing score: how good will the sky be?
          </h2>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {WEIGHT_ROWS.map((r) => (
              <div key={r.key} className="grid grid-cols-[4rem_1fr] gap-3 py-3">
                <dt className="tabular text-lg font-semibold text-aurora-300">{Math.round(VIEWING_WEIGHTS[r.key] * 100)}%</dt>
                <dd>
                  <span className="font-medium text-ink">{r.label}</span>
                  <span className="block text-sm text-ink-muted">{r.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink-muted">
            Labels: 80+ Excellent, 65+ Good, 45+ Fair, below 45 Poor. Missing optional data never counts as bad data — its weight is
            shared by the rest.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="rec-title">
          <h2 id="rec-title" className="text-lg font-semibold">
            2 · Recommendation: is it sensible to go?
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>Only the hours you can reach count: arrival = now + drive time + five minutes to park.</li>
            <li>The best window is the longest steady stretch close to the night&apos;s reachable peak, not a single timestamp.</li>
            <li>Leave-by time = window start − drive − a buffer (10 minutes or 15% of the drive).</li>
            <li>Longer drives and icy or unverified roads lower the recommendation, but never the sky score itself.</li>
            <li>Closed or difficult roads are a hard stop: the next safe alternative is recommended instead.</li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="limits-title">
          <h2 id="limits-title" className="text-lg font-semibold">
            Please read
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Aurora recommendations are probabilistic and do not guarantee visibility. Cloud forecasts can be wrong, auroral activity changes
            quickly, and Icelandic roads and weather can turn dangerous fast. Always check{" "}
            <a className="underline underline-offset-4" href="https://umferdin.is/en" target="_blank" rel="noreferrer">
              umferdin.is
            </a>
            ,{" "}
            <a className="underline underline-offset-4" href="https://en.vedur.is" target="_blank" rel="noreferrer">
              vedur.is
            </a>{" "}
            and{" "}
            <a className="underline underline-offset-4" href="https://safetravel.is" target="_blank" rel="noreferrer">
              safetravel.is
            </a>{" "}
            before you go, and never stop on the road to look at the sky.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="sources-title">
          <h2 id="sources-title" className="text-lg font-semibold">
            Data sources &amp; attribution
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {SOURCES.map((s) => (
              <li key={s.name} className="py-3">
                <a href={s.href} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {s.name}
                </a>
                <p className="mt-0.5 text-sm text-ink-muted">{s.use}</p>
              </li>
            ))}
          </ul>
        </section>

        <Link href="/" className={buttonClass({ variant: "aurora", size: "lg", className: "mt-10" })}>
          Find tonight&apos;s best spot
        </Link>
      </div>
    </main>
  );
}
