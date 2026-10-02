# Aurora

**Where should I go tonight — and when should I leave — to have the best chance of seeing the Northern Lights in Iceland?**

Aurora answers that question. Give it your GPS position or a place in Iceland and it ranks curated, safe viewing spots
using live cloud forecasts, the Icelandic Meteorological Office's aurora activity forecast, darkness at each spot,
light pollution, drive time and official road conditions:

> **Go to Þingvellir National Park tonight.** 44 min drive · 48 km.
> Best viewing **21:30–01:30**. **Leave around 20:35.** Viewing score **89 / 100 — Excellent**.
> Only 5% cloud cover is forecast around 23:00 · favourable for roughly 4 hours · very little light pollution ·
> aurora activity 4/9 · roads on the way reported easily passable.

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

## How recommendations work

The engine never ranks locations statically. It scores **location × time**: every candidate spot, for every
30-minute slot of tonight.

```
origin
  ↓  Phase 1  cheap distance filter (no network): candidates within the travel mode's drive time
  ↓  Phase 2  weather (Open-Meteo, batched + cached) and aurora activity (IMO) — in parallel
  ↓           score every slot: clouds × aurora × darkness × light pollution × weather (× camera)
  ↓  Phase 3  remove slots you can't reach in time, find each spot's best window, provisional ranking
  ↓  Phase 4  route only the top 8 (OSRM / Mapbox; falls back to a conservative estimate)
  ↓  Phase 5  road safety along each route (IRCA) + nearest useful road camera (+ optional vision)
  ↓  Phase 6  final ranking → "Go here, leave at this time, here's why"
```

### 1. Viewing score — "how good will the sky be?" (0–100)

Pure functions in [`src/lib/scoring/viewing-score.ts`](src/lib/scoring/viewing-score.ts), with explicit weights:

| Factor | Weight | Source |
| --- | --- | --- |
| Clear sky | 40% | Open-Meteo low / mid / high / total cloud. Low and mid cloud block aurora; thin high cloud only dims it. |
| Aurora activity | 25% | IMO 0–9 activity forecast (not Kp), with a gentle peak near magnetic midnight (~23:30). |
| Darkness | 15% | Sun altitude computed **at each destination** (civil → astronomical twilight), modest moonlight penalty. |
| Light pollution | 10% | Per-site estimate in the dataset (0 = urban glow, 1 = extremely dark). |
| Weather quality | 5% | Precipitation, visibility, wind. |
| Camera evidence | 5% | Optional AI read of a nearby road camera, for the next two hours only. |

The weighted average is then scaled by **limiting factors**, because cloud must dominate: no amount of darkness helps
under overcast skies, nothing helps in daylight, and a perfect sky with no activity is not "excellent". Missing optional
data (no camera, IMO down) is dropped and the remaining weights are renormalised — absent data never counts as bad data.

Camera evidence is **asymmetric**: a camera that sees aurora is strong positive evidence; a camera that does not see
aurora never lowers the score (road cameras are often badly exposed, pointed at the road, or facing the wrong way).

Labels: **80+ Excellent · 65+ Good · 45+ Fair · <45 Poor**.

### 2. Best window, arrival and departure

- Arrival = now + drive time + 5 minutes to park. A slot counts only if you can be there by its midpoint.
- The best window is the contiguous run of reachable slots within ~10 points of the reachable peak; among such runs the
  one with the largest total wins, so a long steady clearing beats a brief spike.
- **Leave around** = window start − drive − buffer (10 min or 15% of the drive), rounded down to 5 minutes;
  "Leave now" when that is already past.

### 3. Recommendation score — "is it sensible to go?"

Kept separate so a distant spot's sky is never misreported:
`viewing score + up to 6 for a long window − 6 per hour of driving − road penalty (unknown 2, caution 6) − winter-access penalty`.

**Safety is a hard constraint:** a *closed* or *difficult* road (IRCA: impassable, closed, very difficult, mountain
vehicles only, blizzard, storm…) makes a spot **Not recommended** whatever its sky score, and the next safe option is
promoted. Unknown road status is shown as "Road conditions unavailable", never as safe.

### 4. Explanations and confidence

Every reason is generated deterministically from the data ([`reasons.ts`](src/features/recommendations/reasons.ts)) —
no language model writes explanations. Forecast confidence (low / medium / high) is separate from the score and drops
with forecast horizon, missing aurora data, fast-changing or broken cloud, and camera/forecast disagreement.

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
    weather/                 Open-Meteo adapter (batched, per-coordinate cache)
    routing/                 OSRM / Mapbox / estimate providers
    roads/                   IRCA road conditions, code mapping, route-to-segment matching
    cameras/                 IRCA webcams, direction parsing, optional vision provider
    geocoding/               Local + Photon place search
    demo/                    Deterministic offline providers for ?demo=true
    recommendations/         Night window, slot scoring, windows, reasons, confidence, engine, service
  lib/
    scoring/                 Viewing score, windows/departure, recommendation score, labels
    astronomy/               Sun & moon (suncalc) → darkness
    cache.ts, http.ts, geo.ts, time.ts …
```

Providers are plain interfaces ([`src/domain/providers.ts`](src/domain/providers.ts)); the engine receives them through
an `EngineContext`, so live, demo and test providers are interchangeable and the IMO-native weather data could replace
Open-Meteo without touching the scoring.

**Caching** (in-memory per server process, with in-flight de-duplication and stale-on-error):
aurora 15 min · weather 15 min per coordinate · road conditions 5 min · road geometry 24 h (IRCA asks that it is not
fetched many times a day) · camera list 12 h · camera images 5 min · routes 12 h per ~1 km origin cell · place search 24 h.

**Failure handling:** every provider call is isolated. If IMO is down the app ranks on sky conditions and lowers
confidence; failed weather for one spot drops only that spot; routing falls back to an estimate (marked "estimated");
road data falls back to "unavailable — check umferdin.is"; camera failures simply omit camera evidence. A per-source
status panel ("Data sources & freshness") shows what is live, partial or unavailable.

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/recommendations?lat=&lon=&travelMode=nearby\|standard\|chase&label=&demo=` | Ranked recommendations (also accepts `mode=`) |
| `GET /api/location/:id?lat=&lon=&travelMode=` | One destination across the night (origin optional) |
| `GET /api/aurora` | IMO aurora activity forecast, normalised |
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
| [Icelandic Meteorological Office](https://en.vedur.is/weather/forecasts/aurora/) | Aurora activity forecast | `https://xmlweather.vedur.is/aurora?op=xml&lang=en&type=index` |
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
| `OSRM_BASE_URL` | Self-hosted OSRM (default: public demo server) |
| `VISION_API_KEY` | Enables supplementary camera analysis via any OpenAI-compatible endpoint |
| `VISION_API_BASE_URL`, `VISION_MODEL` | Endpoint and model for camera analysis (default OpenAI, `gpt-4o-mini`) |
| `OPEN_METEO_BASE_URL`, `PHOTON_BASE_URL` | Override public endpoints |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style URL (default OpenFreeMap dark) |

## Testing

```bash
npm test
```

Unit tests cover the behaviour the product depends on:

- **Scoring:** lower cloud → higher score; more darkness → higher; higher activity → higher; overcast caps the score;
  daylight is zero; explicit weights; missing camera neither breaks nor penalises scoring; asymmetric camera evidence.
- **Arrival:** a spot whose clear spell ends before you could arrive falls in the ranking; departure = window − drive − buffer.
- **Road safety:** closed / difficult roads are never recommended and the next safe option is promoted; crossing roads
  at junctions are not mistaken for the route; unknown stays unknown.
- **Provider failure:** IMO, weather, routing, roads and cameras each failing degrade gracefully instead of crashing.
- **Adapters:** IMO XML and Open-Meteo parsing against real captured payloads, IRCA camera direction parsing,
  vision-output validation, cache de-duplication and stale-on-error.

## Known limitations

- **Light pollution** scores are manual estimates per site, not a light-pollution raster (VIIRS would be a good next step).
- **Aurora activity** is IMO's national 0–9 index per night; it is not location- or hour-specific. The magnetic-midnight
  time-of-night curve is a modest, documented assumption.
- **Cloud forecasts** are hourly (interpolated to 30 minutes) and only as good as the model — local clearing can be missed.
- **Road matching** uses route geometry within ~250 m of IRCA snow-clearing segments. Very short sections can be missed and
  only roads in IRCA's winter service network are covered; when no route geometry is available only roads near the
  destination are checked (shown in the UI). Volcanic closures and SafeTravel alerts are not ingested.
- **Drive times** from the public OSRM server assume normal conditions; winter driving is slower (the departure buffer
  helps). Use Mapbox or a self-hosted OSRM in production.
- **Cameras:** viewing direction is parsed from IRCA's Icelandic descriptions and only a handful of cameras are manually
  reviewed. Night images are often too dark to judge; analysis only runs at night on images younger than 45 minutes.
- **Caching** is in-process memory: it is not shared across server instances and resets on restart / cold start.
- **Coverage** is Iceland only, using 42 curated, publicly accessible locations — the app never recommends arbitrary
  coordinates.

Aurora recommendations are probabilistic and do not guarantee visibility.
