# Aurora

**Where should I go tonight — and when should I leave — to have the best chance of seeing the Northern Lights in Iceland?**

Aurora answers that question. Give it your GPS position or a place in Iceland and it estimates, for curated, safe
viewing spots, the **chance of seeing the aurora with your own eyes** — from live cloud forecasts, NOAA's real-time and
forecast geomagnetic activity (with the Icelandic Meteorological Office's forecast as a fallback), where the auroral oval
will be relative to each spot, darkness, moonlight and light pollution — then weighs it against drive time, wind and
official road conditions:

> **Go to Þingvellir National Park tonight.** 44 min drive · 48 km.
> Best viewing **22:30–03:00**. **Leave at 21:35.** **75% chance — very good.**
> Only 6% cloud cover is forecast around 23:30 · the auroral oval is expected overhead (Kp ≈ 2.9) ·
> dark, moonless sky · roads on the way reported easily passable.

> ⚠️ **Aurora recommendations are probabilistic and do not guarantee visibility.** Forecasts can be wrong and Icelandic
> roads and weather change fast. Always check [umferdin.is](https://umferdin.is/en), [vedur.is](https://en.vedur.is)
> and [safetravel.is](https://safetravel.is) before driving at night.

---

## Quick start

```bash
npm install          # also copies the MapLibre worker into public/maplibre
npm run dev          # http://localhost:3000
```

No API keys are needed. Try:

- **Live:** open the home page and press **Use my current location**, or search a town or hotel (e.g. "Selfoss", "Hotel Rangá").
- **Demo:** <http://localhost:3000/results?demo=true> — a deterministic, offline February night near Reykjavík
  (Þingvellir comes out on top; Strandarkirkja has a great sky but a closed road, so it is *not recommended*).
  Useful for UI work and screenshots.

Requires Node.js 20.9+ (developed on Node 22).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run calibrate` | Replays 25 years of observed Kp through the aurora model and checks it against FMI statistics (downloads ~17 MB once) |

## How recommendations work

The engine never ranks locations statically. It scores **location × time**: every candidate spot, for every
30-minute slot of tonight.

```
origin
  ↓  Phase 1  cheap distance filter (no network): candidates within the travel mode's drive time
  ↓  Phase 2  weather (Open-Meteo, batched + cached) and activity (NOAA Kp + IMO) — in parallel
  ↓           chance for every slot: P(clear view) × P(aurora bright enough to see)
  ↓  Phase 3  remove slots you can't reach in time, find each spot's best window, provisional ranking
  ↓  Phase 4  route only the top 8 (OSRM / Mapbox; falls back to a conservative estimate)
  ↓  Phase 5  road safety along each route (IRCA) + nearest useful road camera (+ optional vision)
  ↓  Phase 6  final ranking → "Go here, leave at this time, here's why"
```

### 1. Chance of seeing the aurora — sky only (0–100%)

Pure functions in [`src/lib/scoring/`](src/lib/scoring). Seeing the aurora needs *all* of: a clear line of sight, aurora
in view, and aurora brighter than what your eyes can pick out against tonight's sky — so for every half hour the chance
is two gates **multiplied**, never a weighted average where darkness could make up for clouds:

```
chance = P(clear view of the sky) × P(aurora bright enough to see is in view)
```

| Gate / input | Model | Source |
| --- | --- | --- |
| **Clear view** ([`sky-view.ts`](src/lib/scoring/sky-view.ts)) | Low (< 3 km) and mid (3–8 km) cloud block; broken cloud leaves gaps (1 − c² overhead, closer to 1 − c low in the north); fog and precipitation obstruct; the forecast decays towards Iceland's climatological odds with lead time | Open-Meteo (DMI HARMONIE 2 km over Iceland) |
| **Activity** ([`activity.ts`](src/lib/scoring/activity.ts)) | NOAA's real-time Kp for the next hour or two, then NOAA's 3-hour forecast pulled 40% towards a typical night (Kp forecasts are weakly skilful), IMO's midnight forecast as fallback, a typical night (Kp 1.9 ± 1.3) when nothing is available. Uncertainty is carried through five Gauss–Hermite scenarios shared across the night | NOAA SWPC, IMO |
| **Where the oval is** ([`auroral-oval.ts`](src/lib/scoring/auroral-oval.ts)) | Starkov (1994) statistical oval for that Kp and magnetic local time, against each spot's corrected geomagnetic latitude (63.0° at Vík … 65.75° at Húsavík; magnetic midnight ≈ 00:00–00:40 UTC) | Sigernes et al. (2011) coefficients, NASA OMNIWeb CGM |
| **How bright vs. how dark** ([`aurora-visibility.ts`](src/lib/scoring/aurora-visibility.ts), [`sky-brightness.ts`](src/lib/scoring/sky-brightness.ts)) | Brightest aurora in view is log-normal: rises with Kp, peaks in the substorm sector (~23 MLT), fades with distance from the oval and near the horizon, dimmed by thin high cloud. The eye's threshold is 1 kR (IBC I, Milky Way brightness) in a natural dark sky, raised by twilight, moonlight in the aurora's direction and town glow (Crumey 2014 contrast law) | Patat et al. (2006), Krisciunas & Schaefer (1991), Crumey (2014) |

Typical thresholds: 1 kR in a dark sky, ~4 kR at the end of nautical twilight, ~7 kR under a high full moon, ~3 kR at
Grótta. So a bright moon hides moderate aurora but not a strong display, and at Kp 1–2 the north coast has a real edge
over the south coast while from Kp 4 the whole country is under the oval.

**Calibration.** The free constants (median brightness, fade per degree, within-night correlation) were fitted so the
model reproduces the Finnish Meteorological Institute's all-sky-camera statistics — the share of clear dark nights with
aurora from Helsinki (56°) to the Arctic coast (67°) — by replaying 1973–1997 with the observed GFZ Kp record
(`npm run calibrate`): Oulu 19% vs 25%, Kuusamo 30% vs 25%, Sodankylä 56% vs 50%, Kilpisjärvi 77% vs 75%.

**Window chance.** The headline is the chance of seeing aurora at least once during the best window: extra half hours
help, but far less than independent draws (an active night tends to stay active, a cloud deck stays put).

Labels: **70%+ Excellent · 45%+ Good · 20%+ Fair · below Poor**. Chances are shown to the nearest 5% and never as 0% or
100%; the model is good to roughly ±10–15 points, and it describes naked-eye viewing (phone cameras see fainter aurora).
Missing data never counts as bad data. Camera evidence is **asymmetric**: a camera that sees aurora raises the chance
for the next ~45 minutes; one that does not never lowers it (road cameras rarely resolve faint aurora).

A destination's headline chance covers **the best window you can still reach**. It never includes a distance penalty.
Every half hour's chance appears in the destination timeline (unreachable hours are hatched), and each recommendation
carries `skyPeak` — the best half hour of the whole night, ignoring travel. When the night peaks before you could
arrive, the app says so.

### 2. Best window, arrival and departure

- Arrival = now + drive time + 5 minutes to park. A slot counts only if you can be there by its midpoint.
- The best window is a run of reachable slots within reach of the night's best chance (at least half of it, and no more
  than 25 points below), at most five hours long; the run with the highest window chance wins, so a long steady spell
  beats a brief spike. With no half hour above 3% there is no window, and the app explains what holds the night back
  (clouds, low activity or a bright sky).
- **Leave around** = window start − drive − buffer (10 min or 15% of the drive), rounded down to 5 minutes;
  "Leave now" when that is already past.

### 3. Recommendation score — "is it sensible, and worth it, to go?"

Kept separate so a distant spot's chance is never misreported. It stays in percentage points of chance:
`chance × (1 + 0.2 × (scenery − 0.5)) − 8 per hour of driving (+ 4 per hour² beyond 1.5 h) − road (unknown 2, caution 6) − winter access 8 − wind`.

**Scenery.** Seeing the aurora above Kirkjufell or icebergs at Jökulsárlón is a different experience from a lay-by, so
every spot carries an editorial `scenery` rating (0–1: landmark or foreground, water reflections, open view) and a one-line
`highlight`. A sighting above an iconic backdrop is worth up to 10% more than above a plain lakeshore (`SCENERY_VALUE`).
Because it scales with the chance, a famous backdrop decides between similar chances, never beats a clearly better one,
never changes the chance itself, and never overrides a safety warning. Spots rated 0.85+ are labelled **Iconic spot**,
0.65+ **Scenic spot**; plainer spots get no label.

**Safety is a hard constraint:** a *closed* or *difficult* road (IRCA: impassable, closed, very difficult, mountain
vehicles only, blizzard, storm…) or storm-force gusts of 30 m/s (108 km/h) or more at the destination make a spot
**Not recommended** whatever its chance, and the next safe option is promoted. Gusts from about 20 m/s cost points and
trigger a warning. Unknown road status is shown as "Road conditions unavailable", never as safe.

### 4. Explanations and confidence

Every reason is generated deterministically from the data ([`reasons.ts`](src/features/recommendations/reasons.ts)) —
no language model writes explanations. Forecast confidence (low / medium / high) is separate from the chance and drops
with forecast horizon, weak or missing activity data, a chance that swings with the activity scenario, fast-changing or
broken cloud, and camera/forecast disagreement. It is never "high" more than four hours ahead.

## Architecture

```
External APIs → adapters (zod-validated) → normalised domain models → scoring (pure) → recommendation engine → API / pages → UI
```

```
src/
  app/                       Next.js App Router pages + route handlers (/api/*)
  components/                UI (home, results, map, location detail, primitives)
  domain/                    Domain types and provider interfaces (AuroraProvider, WeatherProvider, …)
  data/                      Curated viewing locations (42), towns, reviewed camera metadata
  features/
    aurora/                  IMO XML adapter
    space-weather/           NOAA SWPC Kp forecast + real-time estimate adapter
    weather/                 Open-Meteo adapter (batched, per-coordinate cache)
    routing/                 OSRM / Mapbox / estimate providers
    roads/                   IRCA road conditions, code mapping, route-to-segment matching
    cameras/                 IRCA webcams, direction parsing, optional vision provider
    geocoding/               Local + Photon place search
    demo/                    Deterministic offline providers for ?demo=true
    recommendations/         Night window, slot scoring, windows, reasons, confidence, engine, service
  lib/
    scoring/                 Aurora chance model (oval, sky brightness, sky view, activity), windows, trip score, labels
    astronomy/               Sun & moon positions (suncalc)
    cache.ts, http.ts, geo.ts, time.ts …
```

Providers are plain interfaces ([`src/domain/providers.ts`](src/domain/providers.ts)); the engine receives them through
an `EngineContext`, so live, demo and test providers are interchangeable and the IMO-native weather data could replace
Open-Meteo without touching the scoring.

**Caching** (in-memory per server process, with in-flight de-duplication and stale-on-error):
aurora 15 min · NOAA Kp 10 min · weather 15 min per coordinate · road conditions 5 min · road geometry 24 h (IRCA asks that it is not
fetched many times a day) · camera list 12 h · camera images 5 min · routes 12 h per ~1 km origin cell · place search 24 h.

**Upstream protection:** a failing upstream is backed off for 30 s (serving stale data where possible) instead of
making every request wait for its timeout; data served from cache after a failed refresh is labelled as such, never as
"live". Process-wide request budgets cap routing (OSRM public server ≈ 50/min, Mapbox 120/min by default, configurable
with `ROUTING_MAX_PER_MINUTE`) and place search (Photon 120/min); beyond them the app falls back to estimates and local
search. Camera images are only fetched from IRCA over HTTPS by feed id, and only raster images are proxied.

**Failure handling:** every provider call is isolated. Activity falls back from NOAA to IMO to a typical night (with a
notice and lower confidence); failed weather for one spot drops only that spot; routing falls back to an estimate (marked "estimated");
road data falls back to "unavailable — check umferdin.is"; camera failures simply omit camera evidence. A per-source
status panel ("Data sources & freshness") shows what is live, partial or unavailable.

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/recommendations?lat=&lon=&travelMode=nearby\|standard\|chase&label=&demo=` | Ranked recommendations (also accepts `mode=`) |
| `GET /api/location/:id?lat=&lon=&travelMode=` | One destination across the night (origin optional) |
| `GET /api/aurora` | IMO aurora forecast (expected Kp at midnight per night), normalised |
| `GET /api/locations` | The curated viewing-location dataset |
| `GET /api/cameras?lat=&lon=&radius=` | Nearby IRCA road cameras ranked for sky viewing |
| `GET /api/cameras/:id/image` | Latest camera image (only ids from the official feed; 5-min cache) |
| `GET /api/road-conditions?status=caution,closed&geometry=true` | Normalised IRCA road conditions |
| `GET /api/geocode?q=` | Place search (towns, viewing spots, OpenStreetMap places) |

Errors use one shape: `{ "error": { "code": "INVALID_QUERY", "message": "…" } }`. Timestamps are ISO-8601 strings;
all times in the UI are shown in Iceland time (GMT, no daylight saving).

## Data sources

| Source | Used for | Notes |
| --- | --- | --- |
| [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/products/planetary-k-index) | 3-day Kp forecast and real-time 1-minute estimated Kp | Public domain JSON (`noaa-planetary-k-index-forecast.json`, `planetary_k_index_1m.json`), no key |
| [Icelandic Meteorological Office](https://en.vedur.is/weather/forecasts/aurora/) | Aurora forecast (Kp at midnight) — fallback activity source | `https://xmlweather.vedur.is/aurora?op=xml&lang=en&type=index` |
| [NASA OMNIWeb CGM model](https://omniweb.gsfc.nasa.gov/vitmo/cgm.html) | Corrected geomagnetic latitude and magnetic midnight of each spot (precomputed, epoch 2026) | Stored in the dataset |
| [GFZ Kp index](https://kp.gfz.de/) | Observed Kp 1973–1997 for `npm run calibrate` only | CC BY 4.0 (Matzka et al. 2021) |
| [Icelandic Road and Coastal Administration (IRCA / Vegagerðin)](https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur) | Road conditions (`faerd2017_1`), snow-clearing route geometry (WFS `faerdferlar2017_1`), webcams (`vefmyndavelar2014_1`) | CC BY 4.0. Retrieval times are shown in the app; IRCA does not endorse this app. |
| [Open-Meteo](https://open-meteo.com/) | Hourly cloud layers, temperature, precipitation, visibility, wind | CC BY 4.0, free for non-commercial use |
| [OSRM](https://project-osrm.org/) / OpenStreetMap | Driving routes | Public demo server by default — rate-limited, no SLA |
| [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/) | Driving routes (optional) | Used when `MAPBOX_TOKEN` is set |
| [OpenFreeMap](https://openfreemap.org/) / OpenMapTiles / OpenStreetMap | Base map | No key required |
| [Photon (komoot)](https://photon.komoot.io/) | Place search | Fair-use public instance |
| [SunCalc](https://github.com/mourner/suncalc) | Sun & moon positions, moonrise/set | Computed locally per destination |

## Environment variables

All optional — see [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `ROUTING_PROVIDER` | `mapbox`, `osrm` or `estimate` (default: Mapbox if a token is set, else OSRM) |
| `MAPBOX_TOKEN` | Mapbox Directions token (server-side only) |
| `ROUTING_MAX_PER_MINUTE` | Request budget for Mapbox routing (default 120/min) |
| `OSRM_BASE_URL` | Self-hosted OSRM (default: public demo server) |
| `VISION_API_KEY` | Enables supplementary camera analysis via any OpenAI-compatible endpoint |
| `VISION_API_BASE_URL`, `VISION_MODEL` | Endpoint and model for camera analysis (default OpenAI, `gpt-4o-mini`) |
| `OPEN_METEO_BASE_URL`, `PHOTON_BASE_URL` | Override public endpoints |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style URL (default OpenFreeMap dark) |

## Deploying (free)

The app is designed to run on [Vercel's Hobby plan](https://vercel.com/docs/plans/hobby), which is free for personal,
non-commercial use and cannot bill you — if a monthly allowance (1M function invocations, 100 GB transfer, 4 CPU-hours)
is exceeded, the project is paused rather than charged. No API keys are needed.

```bash
npm i -g vercel        # or use npx vercel
vercel login           # once, in your own terminal
vercel deploy --prod   # builds on Vercel and prints the public URL
```

What keeps a public deployment safe and inside the free tier:

- **No paid services by default.** Every data source used without keys is free; nothing in the default setup can create a bill.
- **Per-IP rate limits** (`src/proxy.ts`): 60 API calls, 40 result pages, 90 searches and 120 camera images per minute per IP.
- **Upstream request budgets** for routing and search, a failure backoff, and caching, so a flood of unique requests can't
  hammer the free public services this app depends on.
- **CDN caching** of public API responses (`s-maxage`), so repeat requests don't run functions at all.
- **Bounded work per request:** routing stops after 8 seconds and the remaining drives are estimated; every upstream call has a timeout.
- **Security headers:** Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a
  permissions policy that only allows geolocation. Camera images are proxied only from IRCA over HTTPS.
- **Secrets stay out of the bundle:** `.env*` files are never committed or uploaded (`.gitignore`, `.vercelignore`); keys
  are read server-side only.

If you later add `MAPBOX_TOKEN` or `VISION_API_KEY`, set them in the Vercel project's *Settings → Environment
Variables* (never in the repo) and set a spending limit in the Mapbox / OpenAI dashboards as well.

## Testing

```bash
npm test
```

Unit tests cover the behaviour the product depends on:

- **Aurora model:** published anchors (Starkov oval at Kp 3, Patat twilight, Krisciunas & Schaefer full moon, 1 kR dark-sky
  threshold); north beats south at low Kp but not in a storm; moonlight, twilight, town glow and thin cirrus hide faint
  aurora far more than strong aurora; midnight beats early evening; the window chance grows with length but far less
  than independent draws; forecast shrinkage, nowcast hand-over and fallbacks.
- **Trip score:** a clearly better chance is worth a longer drive, a marginal one isn't; scenery decides only between
  similar chances; storm-force gusts and closed / difficult roads are hard stops.
- **Arrival:** a spot whose clear spell ends before you could arrive falls in the ranking; departure = window − drive − buffer.
- **Road safety:** closed / difficult roads are never recommended and the next safe option is promoted; crossing roads
  at junctions are not mistaken for the route; unknown stays unknown.
- **Provider failure:** NOAA, IMO, weather, routing, roads and cameras each failing degrade gracefully instead of crashing.
- **Adapters:** NOAA JSON, IMO XML and Open-Meteo parsing against real captured payloads, IRCA camera direction parsing,
  vision-output validation, cache de-duplication and stale-on-error.

`npm run calibrate` (not part of `npm test`; downloads the GFZ Kp record once) replays 1973–1997 through the production
model and fails if any FMI station drifts outside its tolerance.

## Known limitations

- **The chance is a model estimate**, good to roughly ±10–15 points. It is calibrated on Fennoscandian all-sky-camera
  statistics, not Icelandic observations, describes naked-eye viewing, and probably underestimates the small hours
  (after ~03:30, when diffuse morning aurora is common). Kp forecasts themselves have little skill a day ahead.
- **Light pollution** scores are manual estimates per site, mapped to sky brightness — not a light-pollution raster (VIIRS
  would be a good next step). Local horizons (cliffs, forest) are not modelled; every spot is assumed to have an open
  view to within ~3° of the horizon.
- **Cloud forecasts** come from one model (DMI HARMONIE via Open-Meteo), hourly and interpolated to 30 minutes; model
  disagreement is not used yet. Local clearing can be missed.
- **Road matching** uses route geometry within ~250 m of IRCA snow-clearing segments. Very short sections can be missed and
  only roads in IRCA's winter service network are covered; when no route geometry is available only roads near the
  destination are checked (shown in the UI). Volcanic closures and SafeTravel alerts are not ingested.
- **Drive times** from the public OSRM server assume normal conditions; winter driving is slower (the departure buffer
  helps). Use Mapbox or a self-hosted OSRM in production.
- **Cameras:** viewing direction is parsed from IRCA's Icelandic descriptions and only a handful of cameras are manually
  reviewed. Night images are often too dark to judge; analysis only runs at night on images younger than 45 minutes.
- **Caching and request budgets** are in-process memory: they are not shared across server instances and reset on
  restart / cold start. There is no per-client rate limiting; put the app behind a proxy or CDN limit for public deployment.
- **Coverage** is Iceland only, using 42 curated, publicly accessible locations — the app never recommends arbitrary
  coordinates.

Aurora recommendations are probabilistic and do not guarantee visibility.
