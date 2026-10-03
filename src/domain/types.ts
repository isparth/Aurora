export type Coordinates = { lat: number; lon: number };

export type Region =
  | "Capital Region"
  | "Reykjanes"
  | "Golden Circle"
  | "South Coast"
  | "Southeast"
  | "Snæfellsnes"
  | "West"
  | "North";

export type ViewingLocation = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  /**
   * Corrected geomagnetic (CGM) latitude at 110 km, degrees (IGRF, epoch 2026, NASA OMNIWeb CGM model).
   * Decides how often the auroral oval is overhead: ~63° on the south coast, ~65.5° in the north.
   */
  cgmLatitude: number;
  /** UT hour at which the site reaches magnetic midnight (same source), e.g. 0.47 ≈ 00:28 UTC. */
  magneticMidnightUtc: number;
  region: Region;
  /** 0 = strong urban light pollution, 1 = extremely dark. Manually assigned estimate. */
  lightPollutionScore: number;
  /**
   * Editorial rating of the setting for watching and photographing the aurora: landmark or
   * foreground, water reflections, open view. 1 = iconic aurora backdrop, ~0.4 = pleasant but plain.
   * Affects the recommendation score only — never the chance of seeing the aurora (viewing score).
   */
  scenery: number;
  /** One line on what makes the place special, e.g. "Icebergs in a glacier lagoon". */
  highlight: string;
  normalCarAccessible: boolean;
  winterAccessible: boolean;
  parkingAvailable: boolean;
  tags: string[];
  notes?: string;
};

export type TravelMode = "nearby" | "standard" | "chase";

/* ---------- Aurora ---------- */

export type AuroraNight = {
  /** Local (Iceland) date of the evening the night starts, YYYY-MM-DD. */
  eveningDate: string;
  /** IMO's aurora activity forecast for midnight, on the Kp index (0–9) — see en.vedur.is/about-imo/news/nr/2590. */
  activity: number | null;
  sunset?: string;
  darkness?: string;
  dawn?: string;
  sunrise?: string;
  moonDescription?: string;
};

export type AuroraForecast = {
  source: "imo" | "demo";
  fetchedAt: string;
  nights: AuroraNight[];
};

/** One 3-hour block of the planetary Kp index. */
export type KpPoint = {
  /** Start of the block, epoch ms (UTC). */
  time: number;
  kp: number;
  kind: "observed" | "estimated" | "predicted";
};

/** Geomagnetic activity from NOAA's Space Weather Prediction Center. */
export type SpaceWeather = {
  source: "noaa" | "demo";
  fetchedAt: string;
  /** Recent observations, the current estimate and the 3-day forecast, in 3-hour blocks. */
  kp: KpPoint[];
  /** Real-time estimated Kp (mean of the last 30 one-minute values) and when it was measured. */
  nowcast: { time: number; kp: number } | null;
};

/* ---------- Weather ---------- */

export type HourlyWeather = {
  /** Epoch milliseconds (UTC). */
  time: number;
  /** Cloud fractions 0–1. */
  cloudTotal: number;
  cloudLow?: number;
  cloudMid?: number;
  cloudHigh?: number;
  temperatureC?: number;
  precipitationMm?: number;
  visibilityKm?: number;
  windKph?: number;
  gustKph?: number;
};

/* ---------- Roads ---------- */

export type RoadStatus = "good" | "caution" | "difficult" | "closed" | "unknown";

export type RoadSegmentReport = {
  id: string;
  name: string;
  status: RoadStatus;
  description: string;
  updatedAt?: string;
};

export type RoadSafety = {
  status: RoadStatus;
  description?: string;
  /** Segments that determined the status, worst first. */
  segments: RoadSegmentReport[];
  /** "route" = matched along the driving route; "destination" = only roads near the destination. */
  coverage: "route" | "destination" | "none";
  source: "irca" | "demo" | "none";
  fetchedAt?: string;
};

/* ---------- Cameras ---------- */

export type Camera = {
  id: string;
  stationId: number;
  name: string;
  description: string;
  road?: string;
  roadNumber?: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  directionDegrees?: number;
  facesRoad: boolean;
};

export type AuroraCameraMetadata = {
  cameraId: string;
  /** 0–1: how much open sky the camera typically shows. */
  skyVisibilityScore: number;
  usefulForAurora: boolean;
  directionDegrees?: number;
};

export type CameraObservation = {
  usable: boolean;
  skyVisible: boolean;
  nighttime?: boolean;
  /** 0–1 */
  estimatedCloudCover?: number;
  starsVisible?: boolean;
  auroraVisible?: boolean;
  fog?: boolean;
  precipitation?: boolean;
  visibility?: "good" | "moderate" | "poor";
  /** 0–1 */
  confidence: number;
  summary?: string;
  analyzedAt: string;
  model?: string;
};

export type NearbyCamera = {
  camera: Camera;
  metadata: AuroraCameraMetadata;
  distanceKm: number;
  imageUpdatedAt?: string;
  observation?: CameraObservation;
};

/* ---------- Routing ---------- */

export type Route = {
  durationMinutes: number;
  distanceKm: number;
  /** [lon, lat] pairs. */
  geometry?: [number, number][];
  source: "osrm" | "mapbox" | "estimate" | "demo";
  estimated: boolean;
};

/* ---------- Scoring ---------- */

/** Where the activity estimate for a half hour comes from, most reliable first. */
export type ActivitySource = "nowcast" | "forecast" | "imo" | "typical";
/** Where the auroral oval is relative to a site. */
export type AuroraPosition = "overhead" | "north" | "south";
/** What brightens the sky most, if anything (null = dark). */
export type BrightSky = "twilight" | "moon" | "lights" | null;
/** The main reason the chance is low tonight. */
export type LimitingFactor = "clouds" | "activity" | "bright-sky";

/**
 * Why a half hour gets its chance: two gates multiplied — the sky view, and aurora bright enough to see
 * in view. Percentages are 0–100.
 */
export type ScoreComponents = {
  /** Chance the sky towards the aurora is open enough to see it (cloud, fog, rain). */
  skyView: number;
  /** Chance aurora bright enough to see is in view, given tonight's darkness and thin high cloud. */
  aurora: number;
  /** Expected activity used for this half hour (Kp). */
  kp: number;
  /** Where the oval is expected: overhead, or this many degrees of geomagnetic latitude away and how high. */
  oval: { position: AuroraPosition; distanceDeg: number; elevationDeg: number };
  /** Faintest aurora visible against this sky, kR (≈1 in a natural dark sky). */
  thresholdKr: number;
  brightSky: BrightSky;
  /** 0–100 clear-sky evidence from a nearby camera, when it informed this half hour. */
  camera: number | null;
};

export type ConditionsAtTime = {
  /** ISO timestamp. */
  time: string;
  /** Cloud fractions; `effective` is the opaque (low + mid) cover that hides the aurora. */
  clouds: { total: number; low?: number; middle?: number; high?: number; effective: number };
  /** Expected Kp for this half hour and where the estimate comes from. */
  kp: number;
  kpSource: ActivitySource;
  sunAltitude: number;
  moonIllumination: number;
  moonAltitude: number;
  temperatureC?: number;
  windKph?: number;
  gustKph?: number;
  precipitationMm?: number;
  visibilityKm?: number;
};

export type LocationTimeScore = {
  time: string;
  /** 0–100 chance of seeing aurora during this half hour. */
  score: number;
  components: ScoreComponents;
  reachable: boolean;
  conditions: ConditionsAtTime;
};

export type Confidence = "low" | "medium" | "high";

export type ScoreLabel = "Excellent" | "Good" | "Fair" | "Poor";

export type Recommendation = {
  rank: number;
  location: ViewingLocation;
  /**
   * 0–100 chance of seeing the aurora with the naked eye during the best window you can still reach.
   * Sky and aurora only — no drive time, roads or scenery.
   */
  viewingScore: number;
  /** Best half-hour chance inside the window. */
  peakScore: number;
  /** Best half-hour chance of the whole night at this spot, ignoring travel time. */
  skyPeak: { time: string; score: number } | null;
  /** Trip value used for ranking: chance adjusted for drive, roads, wind and scenery (not clamped). */
  recommendationScore: number;
  label: ScoreLabel;
  bestWindow: { start: string; end: string; peak: string } | null;
  recommendedDeparture: string | null;
  leaveNow: boolean;
  earliestArrival: string;
  travel: {
    durationMinutes: number;
    distanceKm: number;
    estimated: boolean;
    source: Route["source"];
    geometry?: [number, number][];
  };
  components: ScoreComponents;
  conditions: ConditionsAtTime | null;
  reasons: string[];
  warnings: string[];
  confidence: Confidence;
  road: RoadSafety;
  recommended: boolean;
  /** What makes the trip unsafe tonight, when it is not recommended. */
  blockedBy?: "road" | "wind";
  notRecommendedReason?: string;
  camera?: NearbyCamera;
  hourly: LocationTimeScore[];
};

export type SourceState = "ok" | "degraded" | "unavailable" | "disabled" | "demo";

export type SourceStatus = { state: SourceState; message?: string; fetchedAt?: string };

export type DataStatus = {
  aurora: SourceStatus;
  /** NOAA geomagnetic activity (Kp forecast and real-time estimate). */
  spaceWeather: SourceStatus;
  weather: SourceStatus;
  routing: SourceStatus;
  roads: SourceStatus;
  cameras: SourceStatus;
  vision: SourceStatus;
};

export type NightWindow = {
  start: string;
  end: string;
  eveningDate: string;
  darkFrom: string | null;
  darkUntil: string | null;
};

export type EmptyReason = "outside-coverage" | "no-candidates" | "no-darkness" | "no-forecast" | "no-window" | "no-chance";

export type Origin = Coordinates & { label: string };

/** Tonight's geomagnetic activity as used for the chances. */
export type AuroraOutlook = {
  /** IMO's Kp forecast for midnight tonight. */
  activity: number | null;
  /** True when any activity data (NOAA or IMO) informs tonight's chances. */
  available: boolean;
  eveningDate: string | null;
  /** NOAA's real-time estimated Kp, when fresh. */
  kpNow: number | null;
  /** Highest expected Kp during tonight's night hours, and when. */
  kpPeak: { kp: number; time: string } | null;
  /** The best source behind tonight's activity estimate. */
  source: ActivitySource;
};

/** A much better sky just beyond the chosen drive time — offered as a one-tap way to search further. */
export type WiderOption = {
  travelMode: TravelMode;
  locationId: string;
  name: string;
  scenery: number;
  /** 0–100 chance of seeing aurora there during its window. */
  viewingScore: number;
  /** Distance-based estimate; the real route and roads are checked once the user widens the search. */
  estimatedDriveMinutes: number;
  window: { start: string; end: string };
};

export type RecommendationResponse = {
  generatedAt: string;
  now: string;
  demo: boolean;
  origin: Origin;
  travelMode: TravelMode;
  maxTravelMinutes: number;
  night: NightWindow | null;
  aurora: AuroraOutlook;
  summary: { headline: string; level: ScoreLabel | null };
  recommendations: Recommendation[];
  notRecommended: Recommendation[];
  widerOption: WiderOption | null;
  emptyReason?: EmptyReason;
  /** The main thing holding the chances back tonight (for the best option, or for every option when none is left). */
  limitingFactor: LimitingFactor | null;
  notices: string[];
  dataStatus: DataStatus;
};

export type MoonInfo = {
  illumination: number;
  phaseName: string;
  rise: string | null;
  set: string | null;
  upDuringWindow: boolean;
};

export type LocationDetail = {
  generatedAt: string;
  now: string;
  demo: boolean;
  origin: Origin | null;
  travelMode: TravelMode;
  night: NightWindow | null;
  aurora: RecommendationResponse["aurora"];
  recommendation: Recommendation | null;
  moon: MoonInfo | null;
  nearbyCameras: NearbyCamera[];
  notices: string[];
  dataStatus: DataStatus;
};
