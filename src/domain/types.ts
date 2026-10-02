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
  region: Region;
  /** 0 = strong urban light pollution, 1 = extremely dark. Manually assigned estimate. */
  lightPollutionScore: number;
  /**
   * Editorial rating of the setting for watching and photographing the aurora: landmark or
   * foreground, water reflections, open view. 1 = iconic aurora backdrop, ~0.4 = pleasant but plain.
   * Affects the recommendation score only — never the sky's viewing score.
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
  /** IMO auroral activity forecast on its 0–9 scale. Not Kp. */
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

export type ScoreComponents = {
  clouds: number;
  aurora: number | null;
  darkness: number;
  lightPollution: number;
  weather: number;
  camera: number | null;
};

export type ViewingScore = {
  overall: number;
  components: ScoreComponents;
};

export type ConditionsAtTime = {
  /** ISO timestamp. */
  time: string;
  clouds: { total: number; low?: number; middle?: number; high?: number; effective: number };
  auroraActivity: number | null;
  /** 0–1, sun and moon combined. */
  darkness: number;
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
  /** Sky quality (no distance penalty) averaged over the best window you can still reach. */
  viewingScore: number;
  peakScore: number;
  /** Best sky of the whole night at this spot, ignoring travel time — the undistorted environmental view. */
  skyPeak: { time: string; score: number } | null;
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
  notRecommendedReason?: string;
  camera?: NearbyCamera;
  hourly: LocationTimeScore[];
};

export type SourceState = "ok" | "degraded" | "unavailable" | "disabled" | "demo";

export type SourceStatus = { state: SourceState; message?: string; fetchedAt?: string };

export type DataStatus = {
  aurora: SourceStatus;
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

export type EmptyReason = "outside-coverage" | "no-candidates" | "no-darkness" | "no-forecast" | "no-window";

export type Origin = Coordinates & { label: string };

/** A much better sky just beyond the chosen drive time — offered as a one-tap way to search further. */
export type WiderOption = {
  travelMode: TravelMode;
  locationId: string;
  name: string;
  scenery: number;
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
  aurora: { activity: number | null; available: boolean; eveningDate: string | null };
  summary: { headline: string; level: ScoreLabel | null };
  recommendations: Recommendation[];
  notRecommended: Recommendation[];
  widerOption: WiderOption | null;
  emptyReason?: EmptyReason;
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
