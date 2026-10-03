import type { Metadata } from "next";
import Link from "next/link";

import { SkyBackground } from "@/components/brand/sky-background";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "How it works & data sources" };

const GATES: { label: string; detail: string }[] = [
  {
    label: "A clear view of the sky",
    detail:
      "Low and mid-level cloud blocks the aurora; broken cloud leaves gaps, which help most when the aurora is overhead. Thin high cloud only dims it, fog and rain obstruct, and a forecast is trusted a little less the further ahead it is.",
  },
  {
    label: "Aurora bright enough to see",
    detail:
      "Activity comes from NOAA's real-time Kp for the next hour or two, then NOAA's 3-hour forecast (pulled towards a typical night, because Kp forecasts are only weakly skilful) or IMO's midnight forecast. An auroral-oval model places the oval for that activity and time of night, and each spot's geomagnetic latitude — about 63° on the south coast, 65.5° in the north — decides whether it is overhead or low in the north. The display's expected brightness is then compared with the faintest aurora your eyes can pick out against tonight's sky: about the Milky Way's brightness in a dark sky, roughly four times that at the end of twilight, and seven times under a high full moon.",
  },
];

const METHOD_SOURCES = [
  "Auroral oval: Starkov (1994), coefficients from Sigernes et al. (2011), J. Space Weather Space Clim. 1, A03",
  "Geomagnetic latitudes: NASA OMNIWeb corrected-geomagnetic model (IGRF, 2026)",
  "Moonlight: Krisciunas & Schaefer (1991), PASP 103, 1033 · Twilight: Patat et al. (2006), A&A 455, 385",
  "Visual threshold: Crumey (2014), MNRAS 442, 2600 · Brightness classes: International Brightness Coefficient",
  "Calibration: Finnish Meteorological Institute all-sky-camera statistics (share of clear nights with aurora, 1973–1997) with the GFZ Kp record",
];

const SOURCES = [
  {
    name: "NOAA Space Weather Prediction Center",
    use: "Geomagnetic activity: the 3-day Kp forecast and the real-time 1-minute estimated Kp (public domain).",
    href: "https://www.swpc.noaa.gov/products/planetary-k-index",
  },
  {
    name: "Icelandic Meteorological Office (Veðurstofa Íslands)",
    use: "Aurora forecast — expected Kp at midnight — for each night, via the official XML service.",
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
            1 · Your chance of seeing the aurora
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            For every half hour, the chance is two gates multiplied — you need both, so one can&apos;t make up for the other:
          </p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {GATES.map((g, i) => (
              <div key={g.label} className="grid grid-cols-[2rem_1fr] gap-3 py-3">
                <dt className="tabular text-lg font-semibold text-aurora-300">{i + 1}</dt>
                <dd>
                  <span className="font-medium text-ink">{g.label}</span>
                  <span className="block text-sm leading-relaxed text-ink-muted">{g.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>
              The chance for your window allows for the fact that a quiet night tends to stay quiet: extra hours help, but less than a fresh
              throw of the dice. Uncertainty in the activity forecast is carried through five scenarios rather than ignored.
            </li>
            <li>
              The model reproduces the Finnish Meteorological Institute&apos;s statistics for Lapland — how often aurora is seen on clear
              nights from 61° to 67° geomagnetic latitude — to within about ten points.
            </li>
            <li>
              70% or more is a very good chance, 45% good, 20% some chance. Chances are shown to the nearest 5% and are good to roughly ±10–15
              points; phone cameras pick up fainter aurora than your eyes. Missing data never counts as bad data — without an activity forecast
              the chance assumes a typical night.
            </li>
          </ul>
          <details className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink">The science behind it</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-subtle">
              {METHOD_SOURCES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </section>

        <section className="mt-10" aria-labelledby="rec-title">
          <h2 id="rec-title" className="text-lg font-semibold">
            2 · Recommendation: is it sensible to go?
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>Only the hours you can reach count: arrival = now + drive time + five minutes to park.</li>
            <li>The best window is the longest steady stretch close to the night&apos;s reachable peak, not a single timestamp.</li>
            <li>Leave-by time = window start − drive − a buffer (10 minutes or 15% of the drive).</li>
            <li>
              Trip value starts from the chance and subtracts what the trip costs: about 8 points per hour of driving (more for drives beyond
              1½ hours), and a few points for icy or unverified roads, winter-only access or strong wind. None of it changes the chance itself.
            </li>
            <li>
              The setting counts too: a sighting above an iconic backdrop like Kirkjufell, Jökulsárlón or Vestrahorn is worth up to 10% more
              than above a plain lakeshore. It decides between similar chances, but never beats a clearly better one.
            </li>
            <li>
              Closed or difficult roads, and storm-force gusts (30 m/s, about 108 km/h) at the destination, are a hard stop: the next safe
              alternative is recommended instead.
            </li>
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
