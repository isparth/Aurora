import type {
  AuroraProvider,
  CameraProvider,
  RoadConditionProvider,
  RoutingProvider,
  VisionProvider,
  WeatherProvider,
} from "@/domain/providers";
import type {
  CameraObservation,
  Coordinates,
  DataStatus,
  HourlyWeather,
  LocationDetail,
  MoonInfo,
  NearbyCamera,
  NightWindow,
  Origin,
  Recommendation,
  RecommendationResponse,
  RoadSafety,
  Route,
  TravelMode,
  ViewingLocation,
  WiderOption,
} from "@/domain/types";
import { activityForNight } from "@/features/aurora/imo-provider";
import { estimateRoute } from "@/features/routing/estimate";
import { moonEvents, moonPhaseName, sunAltitude } from "@/lib/astronomy/darkness";
import { cached } from "@/lib/cache";
import { mapWithConcurrency } from "@/lib/concurrency";
import { haversineKm, thinLine } from "@/lib/geo";
import { describeError, logProviderError } from "@/lib/http";
import { scoreLabel, tonightHeadline } from "@/lib/scoring/labels";
import { computeRecommendationScore } from "@/lib/scoring/recommendation-score";
import { SLOT_MS } from "@/lib/scoring/windows";
import { formatTime, HOUR, isWinterSeason, MINUTE } from "@/lib/time";

import { computeConfidence } from "./confidence";
import { computeNight, type Night } from "./night";
import { buildReasons } from "./reasons";
import { evaluateSlots, planVisit, type SlotEvaluation, type VisitPlan } from "./timeline";
import { TRAVEL_MODES } from "./travel-modes";

export type EngineProviders = {
  aurora: AuroraProvider;
  weather: WeatherProvider;
  routing: RoutingProvider;
  roads: RoadConditionProvider;
  cameras: CameraProvider | null;
  vision: VisionProvider | null;
};

export type EngineContext = {
  providers: EngineProviders;
  locations: ViewingLocation[];
  demo: boolean;
  /** Total time allowed for routing the shortlist; routes not started in time use estimates. */
  routingBudgetMs?: number;
};

export type RecommendRequest = { origin: Origin; travelMode: TravelMode; now: number };

/** Weather is fetched for at most this many nearby candidates. */
const MAX_WEATHER_CANDIDATES = 24;
/** Only the strongest provisional candidates are routed and enriched. */
const ROUTE_TOP_N = 8;
const VISION_TOP_N = 3;
const MAX_RESULTS = 8;
const MAX_NOT_RECOMMENDED = 3;
/** Origins further than this from every curated location are outside coverage. */
const COVERAGE_KM = 250;
/** Estimated drive times are conservative, so allow some slack when filtering on them. */
const ESTIMATE_TOLERANCE = 1.15;
const CAMERA_RADIUS_KM = 30;
/** Keeps a slow routing service from holding the whole request (and a serverless function) open. */
const DEFAULT_ROUTING_BUDGET_MS = 8000;
/** Spots just beyond the chosen drive time that are checked for a "clearer skies further away" hint. */
const WIDER_POOL = 12;
const WIDER_MIN_SCORE = 60;
const WIDER_MIN_GAIN = 15;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };
const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

const iso = (t: number) => new Date(t).toISOString();
const pointOf = (l: ViewingLocation): Coordinates => ({ lat: l.latitude, lon: l.longitude });
const UNKNOWN_ROAD: RoadSafety = { status: "unknown", segments: [], coverage: "none", source: "none" };

function toNightDto(night: Night): NightWindow {
  return {
    start: iso(night.start),
    end: iso(night.end),
    eveningDate: night.eveningDate,
    darkFrom: night.darkFrom === null ? null : iso(night.darkFrom),
    darkUntil: night.darkUntil === null ? null : iso(night.darkUntil),
  };
}

function initialStatus(ctx: EngineContext): DataStatus {
  const state = ctx.demo ? "demo" : "ok";
  return {
    aurora: { state },
    weather: { state },
    routing: { state },
    roads: { state },
    cameras: ctx.providers.cameras ? { state } : { state: "disabled" },
    vision: ctx.providers.vision
      ? { state }
      : { state: "disabled", message: "Set VISION_API_KEY to enable supplementary camera analysis." },
  };
}

/** Data older than this was served from cache because a refresh failed — say so instead of calling it live. */
const STALE_AFTER = { aurora: 30 * MINUTE, roads: 15 * MINUTE };
const isStale = (fetchedAt: string | undefined, now: number, limit: number) =>
  fetchedAt !== undefined && now - Date.parse(fetchedAt) > limit;

function resolveAurora(
  result: Settled<Awaited<ReturnType<AuroraProvider["getForecast"]>>>,
  eveningDate: string,
  ctx: EngineContext,
  status: DataStatus,
  notices: string[],
  now: number,
): RecommendationResponse["aurora"] {
  if (!result.ok) {
    logProviderError("aurora", result.error);
    status.aurora = { state: "unavailable", message: describeError(result.error) };
    notices.push("Aurora activity temporarily unavailable — rankings use sky conditions only.");
    return { activity: null, available: false, eveningDate };
  }
  const { activity, fromDate } = activityForNight(result.value, eveningDate);
  const approximate = fromDate !== null && fromDate !== eveningDate;
  const stale = !ctx.demo && isStale(result.value.fetchedAt, now, STALE_AFTER.aurora);
  status.aurora = {
    state: ctx.demo ? "demo" : activity === null || approximate || stale ? "degraded" : "ok",
    fetchedAt: result.value.fetchedAt,
  };
  if (activity === null) {
    status.aurora.message = "No IMO activity forecast for tonight.";
    notices.push("IMO has not published an aurora activity forecast for tonight — rankings use sky conditions only.");
  } else if (approximate) {
    status.aurora.message = `Using IMO's forecast for the night of ${fromDate}.`;
  }
  if (stale) {
    status.aurora.message = "Latest update failed; showing the last forecast received.";
    notices.push(`The aurora forecast couldn't be refreshed — showing IMO data from ${formatTime(result.value.fetchedAt)}.`);
  }
  return { activity, available: activity !== null, eveningDate };
}

function resolveRoadsFreshness(fetchedAt: string | undefined, ctx: EngineContext, status: DataStatus, notices: string[], now: number) {
  status.roads = { ...status.roads, fetchedAt };
  if (!ctx.demo && isStale(fetchedAt, now, STALE_AFTER.roads)) {
    status.roads = { state: "degraded", fetchedAt, message: "Latest update failed; showing the last report received." };
    notices.push(`Road conditions couldn't be refreshed — last official report ${formatTime(fetchedAt!)}. Check umferdin.is before you travel.`);
  }
}

async function fetchWeather(provider: WeatherProvider, points: Coordinates[]): Promise<(HourlyWeather[] | Error)[]> {
  if (provider.getHourlyForecasts) {
    try {
      return await provider.getHourlyForecasts(points);
    } catch (error) {
      return points.map(() => (error instanceof Error ? error : new Error(String(error))));
    }
  }
  const results = await mapWithConcurrency(points, 4, (p) => provider.getHourlyForecast(p.lat, p.lon));
  return results.map((r) => (r.status === "fulfilled" ? r.value : r.reason instanceof Error ? r.reason : new Error(String(r.reason))));
}

async function findCamera(cameras: CameraProvider, point: Coordinates): Promise<NearbyCamera | undefined> {
  const nearby = await cameras.getNearbyCameras(point.lat, point.lon, CAMERA_RADIUS_KM);
  const best = nearby.find((c) => c.metadata.usefulForAurora);
  if (!best) return undefined;
  const imageUpdatedAt = await cameras.getImageTimestamp?.(best.camera.id).catch(() => undefined);
  return { ...best, imageUpdatedAt };
}

/** Vision only runs at night on fresh images; results are cached per image. */
async function analyseCamera(
  cameras: CameraProvider,
  vision: VisionProvider,
  nearby: NearbyCamera,
  now: number,
): Promise<CameraObservation | undefined> {
  const cam = nearby.camera;
  if (sunAltitude(now, { lat: cam.latitude, lon: cam.longitude }) > -6) return undefined;
  // An image of unknown or old age says nothing reliable about the sky right now.
  if (!nearby.imageUpdatedAt || now - Date.parse(nearby.imageUpdatedAt) > 45 * MINUTE) return undefined;
  const image = await cameras.getCameraImage(cam.id);
  if (!image) return undefined;
  const version = image.lastModified ?? String(Math.floor(now / (10 * MINUTE)));
  return cached(`vision:${vision.model}:${cam.id}:${version}`, 30 * MINUTE, () => vision.analyze(image, cam, now));
}

type Candidate = { location: ViewingLocation; point: Coordinates; estimate: Route };

/** Best sky among spots beyond the current drive limit, judged on estimated drive times only (no routing calls). */
function findWiderOption(
  pool: Candidate[],
  weather: (HourlyWeather[] | Error)[],
  night: Night,
  auroraActivity: number | null,
  now: number,
): WiderOption | null {
  let best: WiderOption | null = null;
  for (let i = 0; i < pool.length; i++) {
    const { location, estimate } = pool[i];
    const hourly = weather[i];
    if (!hourly || hourly instanceof Error || hourly.length === 0) continue;
    if (!location.winterAccessible && isWinterSeason(now)) continue;
    const evaluations = evaluateSlots({ location, hourly, slots: night.slots, auroraActivity, now });
    const plan = planVisit(evaluations, now, estimate.durationMinutes);
    if (plan.windowStart === null || plan.windowEnd === null || plan.viewingScore < WIDER_MIN_SCORE) continue;
    if (best && plan.viewingScore <= best.viewingScore) continue;
    best = {
      travelMode: estimate.durationMinutes <= TRAVEL_MODES.standard.maxMinutes * ESTIMATE_TOLERANCE ? "standard" : "chase",
      locationId: location.id,
      name: location.name,
      viewingScore: plan.viewingScore,
      estimatedDriveMinutes: estimate.durationMinutes,
      window: { start: iso(plan.windowStart), end: iso(plan.windowEnd) },
    };
  }
  return best;
}

/** Forecast cloud for the slot containing `now` — what a camera image taken now should agree with. */
function forecastCloudNow(evaluations: SlotEvaluation[], now: number): number | null {
  const current = evaluations.find((e) => now >= e.time && now < e.time + SLOT_MS);
  return current ? current.conditions.clouds.effective : null;
}

export function buildRecommendation(args: {
  location: ViewingLocation;
  evaluations: SlotEvaluation[];
  plan: VisitPlan;
  travel: Route;
  road: RoadSafety;
  camera?: NearbyCamera;
  auroraActivity: number | null;
  now: number;
}): Recommendation {
  const { location, evaluations, plan, travel, road, camera, auroraActivity, now } = args;
  const window = plan.window;
  const winterAccessConcern = !location.winterAccessible && isWinterSeason(now);

  const peakIndex = window
    ? window.peakIndex
    : evaluations.reduce((best, e, i) => (e.score > (evaluations[best]?.score ?? -1) ? i : best), 0);
  const peakEval: SlotEvaluation | undefined = evaluations[peakIndex];

  const windowMinutes = plan.windowStart !== null && plan.windowEnd !== null ? (plan.windowEnd - plan.windowStart) / MINUTE : 0;
  const { score, recommended } = computeRecommendationScore({
    viewingScore: plan.viewingScore,
    windowMinutes,
    driveMinutes: travel.durationMinutes,
    roadStatus: road.status,
    winterAccessConcern,
  });

  let reasons: string[] = [];
  let warnings: string[] = [];
  let confidence: Recommendation["confidence"] = "low";

  if (window && plan.windowStart !== null && plan.windowEnd !== null && peakEval) {
    const windowEvals = evaluations.slice(window.startIndex, window.endIndex + 1);
    ({ reasons, warnings } = buildReasons({
      location,
      windowStart: plan.windowStart,
      windowEnd: plan.windowEnd,
      peakTime: peakEval.time,
      peakScore: window.peakScore,
      peak: peakEval.conditions,
      auroraActivity,
      road,
      camera,
      moonUpDuringWindow: windowEvals.some((e) => e.conditions.moonAltitude > 0),
      missedPeak: plan.nightPeak && plan.nightPeak.time + SLOT_MS / 2 < plan.earliestViewing ? plan.nightPeak : null,
      winterAccessConcern,
    }));
    const obs = camera?.observation;
    const forecastNow = forecastCloudNow(evaluations, now);
    confidence = computeConfidence({
      hoursAhead: (plan.windowStart - now) / HOUR,
      auroraAvailable: auroraActivity !== null,
      windowClouds: evaluations
        .slice(Math.max(0, window.startIndex - 2), window.endIndex + 3)
        .map((e) => e.conditions.clouds.effective),
      camera:
        obs?.usable && obs.skyVisible && obs.estimatedCloudCover !== undefined && forecastNow !== null
          ? { observedCloud: obs.estimatedCloudCover, forecastCloud: forecastNow }
          : null,
    });
  } else {
    warnings = ["No reachable viewing window remains tonight."];
  }

  return {
    rank: 0,
    location,
    viewingScore: plan.viewingScore,
    peakScore: plan.peakScore,
    skyPeak: plan.nightPeak ? { time: iso(plan.nightPeak.time), score: plan.nightPeak.score } : null,
    recommendationScore: score,
    label: scoreLabel(plan.viewingScore),
    bestWindow:
      window && plan.windowStart !== null && plan.windowEnd !== null && peakEval
        ? { start: iso(plan.windowStart), end: iso(plan.windowEnd), peak: iso(peakEval.time) }
        : null,
    recommendedDeparture: plan.departure ? iso(plan.departure.departure) : null,
    leaveNow: plan.departure?.leaveNow ?? false,
    earliestArrival: iso(plan.earliestViewing),
    travel: {
      durationMinutes: travel.durationMinutes,
      distanceKm: travel.distanceKm,
      estimated: travel.estimated,
      source: travel.source,
      geometry: travel.geometry ? thinLine(travel.geometry, 160) : undefined,
    },
    components: peakEval?.components ?? { clouds: 0, aurora: null, darkness: 0, lightPollution: 0, weather: 0, camera: null },
    conditions: peakEval?.conditions ?? null,
    reasons,
    warnings,
    confidence,
    road,
    recommended,
    notRecommendedReason: recommended
      ? undefined
      : `Not recommended: road ${road.status === "closed" ? "closed" : "conditions are difficult"}${road.description ? ` — ${road.description}` : ""}.`,
    camera,
    hourly: evaluations.map((e, i) => ({
      time: iso(e.time),
      score: e.score,
      components: e.components,
      reachable: plan.reachable[i],
      conditions: e.conditions,
    })),
  };
}

export function compareRecommendations(a: Recommendation, b: Recommendation): number {
  if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
  return (
    b.recommendationScore - a.recommendationScore ||
    b.viewingScore - a.viewingScore ||
    a.travel.durationMinutes - b.travel.durationMinutes
  );
}

/**
 * The central pipeline:
 * origin → candidates → cheap distance filter → weather + aurora → location × time scoring →
 * provisional ranking → routing for the best few → road / camera enrichment → final ranking.
 */
export async function recommend(req: RecommendRequest, ctx: EngineContext): Promise<RecommendationResponse> {
  const { origin, travelMode, now } = req;
  const { providers } = ctx;
  const maxMinutes = TRAVEL_MODES[travelMode].maxMinutes;
  const status = initialStatus(ctx);
  const notices: string[] = [];

  const respond = (partial: Partial<RecommendationResponse>): RecommendationResponse => ({
    generatedAt: iso(now),
    now: iso(now),
    demo: ctx.demo,
    origin,
    travelMode,
    maxTravelMinutes: maxMinutes,
    night: null,
    aurora: { activity: null, available: false, eveningDate: null },
    summary: { headline: tonightHeadline(null), level: null },
    recommendations: [],
    notRecommended: [],
    widerOption: null,
    notices,
    dataStatus: status,
    ...partial,
  });

  const nearestKm = Math.min(...ctx.locations.map((l) => haversineKm(origin, pointOf(l))));
  if (!(nearestKm <= COVERAGE_KM)) return respond({ emptyReason: "outside-coverage" });

  const night = computeNight(origin, now);
  if (!night) return respond({ emptyReason: "no-darkness" });

  // Location-independent sources start straight away and run in parallel with everything else.
  const auroraPromise = settle(providers.aurora.getForecast());
  const roadsWarm = providers.roads.prefetch?.().catch(() => undefined);
  const camerasWarm = providers.cameras?.getAllCameras().catch(() => undefined);

  // Phase 1 — cheap geographic filter, no network.
  const all: Candidate[] = ctx.locations
    .map((location) => ({ location, point: pointOf(location), estimate: estimateRoute(origin, pointOf(location)) }))
    .sort((a, b) => a.estimate.distanceKm - b.estimate.distanceKm);
  const inMode = (c: Candidate, minutes: number) => c.estimate.durationMinutes <= minutes * ESTIMATE_TOLERANCE;
  const candidates = all.filter((c) => inMode(c, maxMinutes)).slice(0, MAX_WEATHER_CANDIDATES);
  const widerPool =
    travelMode === "chase" ? [] : all.filter((c) => !inMode(c, maxMinutes) && inMode(c, TRAVEL_MODES.chase.maxMinutes)).slice(0, WIDER_POOL);

  // Phase 2 — weather (batched, cached) and aurora, concurrently.
  const points = [...candidates, ...widerPool].map((c) => c.point);
  const [auroraResult, weatherAll] = await Promise.all([
    auroraPromise,
    points.length > 0 ? fetchWeather(providers.weather, points) : Promise.resolve([]),
  ]);
  const aurora = resolveAurora(auroraResult, night.eveningDate, ctx, status, notices, now);
  const nightDto = toNightDto(night);
  const weather = weatherAll.slice(0, candidates.length);
  const wider = findWiderOption(widerPool, weatherAll.slice(candidates.length), night, aurora.activity, now);
  const widerThan = (score: number | null) => (wider && (score === null || wider.viewingScore >= score + WIDER_MIN_GAIN) ? wider : null);
  if (candidates.length === 0) return respond({ night: nightDto, aurora, emptyReason: "no-candidates", widerOption: widerThan(null) });

  const scored = candidates.flatMap((c, i) => {
    const hourly = weather[i];
    if (!hourly || hourly instanceof Error || hourly.length === 0) return [];
    return [{ ...c, hourly, evaluations: evaluateSlots({ location: c.location, hourly, slots: night.slots, auroraActivity: aurora.activity, now }) }];
  });
  const failedWeather = candidates.length - scored.length;
  if (failedWeather > 0) logProviderError("weather", weather.find((w) => w instanceof Error));
  if (scored.length === 0) {
    status.weather = { state: "unavailable", message: "Weather forecasts could not be loaded." };
    notices.push("Weather forecasts are temporarily unavailable, so locations cannot be ranked right now.");
    return respond({ night: nightDto, aurora, emptyReason: "no-forecast" });
  }
  if (failedWeather > 0) {
    status.weather = { state: "degraded", message: `No forecast for ${failedWeather} location(s).` };
    notices.push(`Weather forecasts were unavailable for ${failedWeather} location(s); they are not ranked.`);
  }

  // Phase 3 — provisional ranking on estimated drive times.
  const provisional = scored
    .map((s) => {
      const plan = planVisit(s.evaluations, now, s.estimate.durationMinutes);
      const windowMinutes = plan.windowStart !== null && plan.windowEnd !== null ? (plan.windowEnd - plan.windowStart) / MINUTE : 0;
      const prelim = computeRecommendationScore({
        viewingScore: plan.viewingScore,
        windowMinutes,
        driveMinutes: s.estimate.durationMinutes,
        roadStatus: "unknown",
        winterAccessConcern: !s.location.winterAccessible && isWinterSeason(now),
      }).score;
      return { s, plan, prelim };
    })
    .filter((p) => p.plan.window !== null)
    .sort((a, b) => b.prelim - a.prelim)
    .slice(0, ROUTE_TOP_N);

  if (provisional.length === 0) return respond({ night: nightDto, aurora, emptyReason: "no-window", widerOption: widerThan(null) });

  // Phase 4 — route only the strongest candidates.
  const routingDeadline = Date.now() + (ctx.routingBudgetMs ?? DEFAULT_ROUTING_BUDGET_MS);
  const routeResults = await mapWithConcurrency(provisional, providers.routing.maxConcurrency ?? 3, (p) =>
    Date.now() > routingDeadline ? Promise.reject(new Error("routing time budget exceeded")) : providers.routing.route(origin, p.s.point),
  );
  const travels: Route[] = routeResults.map((r, i) => (r.status === "fulfilled" ? r.value : provisional[i].s.estimate));
  const routeFailures = routeResults.filter((r) => r.status === "rejected").length;
  const firstRouteFailure = routeResults.find((r) => r.status === "rejected");
  if (firstRouteFailure?.status === "rejected") logProviderError("routing", firstRouteFailure.reason);
  if (providers.routing.name === "estimate") {
    status.routing = { state: ctx.demo ? "demo" : "degraded", message: "Drive times are estimated from distance." };
  } else if (routeFailures === routeResults.length) {
    status.routing = { state: "unavailable", message: "Routing service unavailable." };
    notices.push("Routing is unavailable — drive times are estimated from distance.");
  } else if (routeFailures > 0) {
    status.routing = { state: "degraded", message: `${routeFailures} drive time(s) estimated.` };
  }

  // Phase 5 — road safety and cameras for the shortlist.
  await Promise.all([roadsWarm, camerasWarm]);
  const roadResults = await mapWithConcurrency(provisional, 4, (p, i) =>
    providers.roads.assess(
      p.s.point,
      travels[i].geometry ? travels[i].geometry!.map(([lon, lat]) => ({ lat, lon })) : null,
    ),
  );
  const roads = roadResults.map((r) => (r.status === "fulfilled" ? r.value : UNKNOWN_ROAD));
  if (roadResults.every((r) => r.status === "rejected")) {
    const first = roadResults[0];
    if (first?.status === "rejected") logProviderError("roads", first.reason);
    status.roads = { state: "unavailable", message: first?.status === "rejected" ? describeError(first.reason) : undefined };
    notices.push("Road conditions unavailable — check official road information (umferdin.is) before you travel.");
  } else {
    resolveRoadsFreshness(roads.find((r) => r.fetchedAt)?.fetchedAt, ctx, status, notices, now);
  }

  const cameraProvider = providers.cameras;
  let cameras: (NearbyCamera | undefined)[] = provisional.map(() => undefined);
  if (cameraProvider) {
    const cameraResults = await mapWithConcurrency(provisional, 4, (p) => findCamera(cameraProvider, p.s.point));
    cameras = cameraResults.map((r) => (r.status === "fulfilled" ? r.value : undefined));
    if (cameraResults.every((r) => r.status === "rejected")) {
      const first = cameraResults[0];
      if (first?.status === "rejected") logProviderError("cameras", first.reason);
      status.cameras = { state: "unavailable", message: "Road cameras unavailable." };
    }

    const vision = providers.vision;
    if (vision) {
      const targets = cameras.map((c, i) => ({ c, i })).filter((x) => x.c).slice(0, VISION_TOP_N);
      const visionResults = await mapWithConcurrency(targets, 2, ({ c }) => analyseCamera(cameraProvider, vision, c!, now));
      visionResults.forEach((r, k) => {
        const { i } = targets[k];
        if (r.status === "fulfilled" && r.value) cameras[i] = { ...cameras[i]!, observation: r.value };
      });
      if (targets.length > 0 && visionResults.every((r) => r.status === "rejected")) {
        const first = visionResults[0];
        if (first?.status === "rejected") logProviderError("vision", first.reason);
        status.vision = { state: "unavailable", message: "Camera analysis failed; camera evidence omitted." };
      }
    }
  }

  // Phase 6 — final ranking with real travel times, road safety and camera evidence.
  let withinTravelLimit = 0;
  const final = provisional.flatMap((p, i) => {
    const travel = travels[i];
    const limit = travel.estimated ? maxMinutes * ESTIMATE_TOLERANCE : maxMinutes + 5;
    if (travel.durationMinutes > limit) return [];
    withinTravelLimit++;
    const camera = cameras[i];
    const evaluations = camera?.observation
      ? evaluateSlots({ location: p.s.location, hourly: p.s.hourly, slots: night.slots, auroraActivity: aurora.activity, now, camera: camera.observation })
      : p.s.evaluations;
    const plan = planVisit(evaluations, now, travel.durationMinutes);
    if (!plan.window) return [];
    return [buildRecommendation({ location: p.s.location, evaluations, plan, travel, road: roads[i], camera, auroraActivity: aurora.activity, now })];
  });
  final.sort(compareRecommendations);

  const recommendations = final.filter((r) => r.recommended).slice(0, MAX_RESULTS).map((r, i) => ({ ...r, rank: i + 1 }));
  const notRecommended = final.filter((r) => !r.recommended).slice(0, MAX_NOT_RECOMMENDED);
  const top = recommendations[0];

  return respond({
    night: nightDto,
    aurora,
    summary: { headline: tonightHeadline(top ? top.viewingScore : null), level: top ? scoreLabel(top.viewingScore) : null },
    recommendations,
    notRecommended,
    widerOption: widerThan(top ? top.viewingScore : null),
    emptyReason: final.length > 0 ? undefined : withinTravelLimit === 0 ? "no-candidates" : "no-window",
  });
}

function moonInfo(evaluations: SlotEvaluation[], night: Night, point: Coordinates, window: Recommendation["bestWindow"]): MoonInfo | null {
  if (evaluations.length === 0) return null;
  const reference = window ? Date.parse(window.peak) : night.slots[Math.floor(night.slots.length / 2)];
  const ref = evaluations.reduce((best, e) => (Math.abs(e.time - reference) < Math.abs(best.time - reference) ? e : best));
  const { rise, set } = moonEvents(night.start, night.end, point);
  const inWindow = window
    ? evaluations.filter((e) => e.time >= Date.parse(window.start) - SLOT_MS && e.time < Date.parse(window.end))
    : evaluations;
  return {
    illumination: ref.conditions.moonIllumination,
    phaseName: moonPhaseName(ref.time),
    rise: rise === null ? null : iso(rise),
    set: set === null ? null : iso(set),
    upDuringWindow: inWindow.some((e) => e.conditions.moonAltitude > 0),
  };
}

/** Full evaluation of one destination for the detail page (not limited to the shortlist). */
export async function evaluateLocation(
  req: { locationId: string; origin: Origin | null; travelMode: TravelMode; now: number },
  ctx: EngineContext,
): Promise<LocationDetail | null> {
  const location = ctx.locations.find((l) => l.id === req.locationId);
  if (!location) return null;
  const { providers } = ctx;
  const { origin, now } = req;
  const point = pointOf(location);
  const status = initialStatus(ctx);
  const notices: string[] = [];

  const base: LocationDetail = {
    generatedAt: iso(now),
    now: iso(now),
    demo: ctx.demo,
    origin,
    travelMode: req.travelMode,
    night: null,
    aurora: { activity: null, available: false, eveningDate: null },
    recommendation: null,
    moon: null,
    nearbyCameras: [],
    notices,
    dataStatus: status,
  };

  const night = computeNight(origin ?? point, now);
  if (!night) return base;

  const zeroTravel: Route = { durationMinutes: 0, distanceKm: 0, source: "estimate", estimated: true };
  const [auroraResult, weatherResult, routeResult, nearbyResult] = await Promise.all([
    settle(providers.aurora.getForecast()),
    settle(providers.weather.getHourlyForecast(point.lat, point.lon)),
    origin ? settle(providers.routing.route(origin, point)) : Promise.resolve<Settled<Route>>({ ok: true, value: zeroTravel }),
    providers.cameras
      ? settle(providers.cameras.getNearbyCameras(point.lat, point.lon, CAMERA_RADIUS_KM))
      : Promise.resolve<Settled<NearbyCamera[]>>({ ok: true, value: [] }),
  ]);

  const aurora = resolveAurora(auroraResult, night.eveningDate, ctx, status, notices, now);
  const travel = routeResult.ok ? routeResult.value : estimateRoute(origin as Origin, point);
  if (!routeResult.ok) {
    logProviderError("routing", routeResult.error);
    status.routing = { state: "unavailable", message: describeError(routeResult.error) };
    notices.push("Routing is unavailable — the drive time is estimated from distance.");
  } else if (travel.estimated && origin) {
    status.routing = { state: ctx.demo ? "demo" : "degraded", message: "Drive time is estimated from distance." };
  }

  const roadResult = await settle(
    providers.roads.assess(point, travel.geometry ? travel.geometry.map(([lon, lat]) => ({ lat, lon })) : null),
  );
  const road = roadResult.ok ? roadResult.value : UNKNOWN_ROAD;
  if (!roadResult.ok) {
    logProviderError("roads", roadResult.error);
    status.roads = { state: "unavailable", message: describeError(roadResult.error) };
    notices.push("Road conditions unavailable — check official road information (umferdin.is) before you travel.");
  } else {
    resolveRoadsFreshness(road.fetchedAt, ctx, status, notices, now);
  }

  let nearbyCameras: NearbyCamera[] = [];
  let camera: NearbyCamera | undefined;
  if (!nearbyResult.ok) {
    logProviderError("cameras", nearbyResult.error);
    status.cameras = { state: "unavailable", message: "Road cameras unavailable." };
  } else if (providers.cameras) {
    nearbyCameras = nearbyResult.value.slice(0, 4);
    const best = nearbyCameras.find((c) => c.metadata.usefulForAurora);
    if (best) {
      const imageUpdatedAt = await providers.cameras.getImageTimestamp?.(best.camera.id).catch(() => undefined);
      camera = { ...best, imageUpdatedAt };
      if (providers.vision) {
        const obs = await settle(analyseCamera(providers.cameras, providers.vision, camera, now));
        if (obs.ok && obs.value) camera = { ...camera, observation: obs.value };
        if (!obs.ok) {
          logProviderError("vision", obs.error);
          status.vision = { state: "unavailable", message: "Camera analysis failed; camera evidence omitted." };
        }
      }
      nearbyCameras = nearbyCameras.map((c) => (c.camera.id === camera!.camera.id ? camera! : c));
    }
  }

  if (!weatherResult.ok) {
    logProviderError("weather", weatherResult.error);
    status.weather = { state: "unavailable", message: describeError(weatherResult.error) };
    notices.push("The weather forecast for this location is temporarily unavailable.");
    return { ...base, night: toNightDto(night), aurora, nearbyCameras };
  }

  const evaluations = evaluateSlots({ location, hourly: weatherResult.value, slots: night.slots, auroraActivity: aurora.activity, now, camera: camera?.observation });
  const plan = planVisit(evaluations, now, travel.durationMinutes);
  const recommendation = buildRecommendation({ location, evaluations, plan, travel, road, camera, auroraActivity: aurora.activity, now });

  return {
    ...base,
    night: toNightDto(night),
    aurora,
    recommendation,
    moon: moonInfo(evaluations, night, point, recommendation.bestWindow),
    nearbyCameras,
  };
}
