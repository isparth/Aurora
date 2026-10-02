import { VIEWING_LOCATIONS } from "@/data/viewing-locations";
import type { CameraProvider, RoadConditionProvider, RoutingProvider, VisionProvider, WeatherProvider } from "@/domain/providers";
import type { Camera, Coordinates, HourlyWeather, RoadSafety, RoadStatus } from "@/domain/types";
import type { EngineContext } from "@/features/recommendations/engine";
import { cameraMetadata } from "@/features/cameras/irca-cameras";
import { estimateRoute } from "@/features/routing/estimate";
import { haversineKm } from "@/lib/geo";
import { HOUR, MINUTE } from "@/lib/time";

/**
 * Deterministic demo scenario for development and screenshots: a clear, moonless February night
 * near Reykjavík where Þingvellir clears around 22:00. No network access is needed.
 */
export const DEMO_NOW = Date.UTC(2026, 1, 16, 19, 40);
const DEMO_EVENING = "2026-02-16";
const EVENING_18H = Date.UTC(2026, 1, 16, 18);
const REYKJAVIK: Coordinates = { lat: 64.1466, lon: -21.9426 };

/** Cloud cover control points: [hours after 18:00, fraction]. */
const CLOUD_PROFILES: Record<string, [number, number][]> = {
  thingvellir: [[0, 0.85], [2, 0.6], [3, 0.35], [4, 0.08], [5, 0.05], [6, 0.06], [7, 0.1], [8, 0.35], [9, 0.6], [12, 0.8]],
  kleifarvatn: [[0, 0.7], [2, 0.45], [3, 0.2], [3.5, 0.14], [5, 0.17], [6, 0.45], [7, 0.7], [12, 0.8]],
  hvalfjordur: [[0, 0.9], [3, 0.7], [4, 0.42], [5, 0.2], [6, 0.18], [7, 0.36], [8, 0.62], [12, 0.8]],
  grotta: [[0, 0.9], [4, 0.75], [5.5, 0.55], [6.25, 0.48], [7, 0.55], [8, 0.82], [12, 0.9]],
  strandarkirkja: [[0, 0.5], [2, 0.1], [3, 0.04], [7, 0.05], [9, 0.3], [12, 0.6]],
  seljalandsfoss: [[0, 0.6], [3, 0.25], [5, 0.12], [7, 0.15], [9, 0.4], [12, 0.6]],
  skogafoss: [[0, 0.65], [3, 0.3], [5, 0.16], [7, 0.2], [9, 0.45], [12, 0.6]],
};

const ROAD_OVERRIDES: Record<string, { status: RoadStatus; description: string }> = {
  strandarkirkja: { status: "closed", description: "Impassable on Suðurstrandarvegur: Þorlákshöfn - Krýsuvík" },
  hvalfjordur: { status: "caution", description: "Spots of ice on Hvalfjarðarvegur" },
};

/** Drive times from central Reykjavík (minutes, km), as a router would return them. */
const DEMO_ROUTES: Record<string, [number, number]> = {
  thingvellir: [44, 48],
  kleifarvatn: [37, 33],
  hvalfjordur: [52, 62],
  grotta: [16, 7],
  strandarkirkja: [50, 49],
  hafravatn: [22, 18],
  hvaleyrarvatn: [20, 16],
  seltun: [40, 39],
  kerid: [61, 71],
  akranes: [48, 49],
};

function hashUnit(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function cloudAt(id: string, hoursAfter18: number): number {
  const profile = CLOUD_PROFILES[id];
  if (!profile) {
    const u = hashUnit(id);
    return Math.min(0.95, Math.max(0.35, 0.6 + 0.25 * u + 0.12 * Math.sin(hoursAfter18 / 2 + u * 6)));
  }
  if (hoursAfter18 <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [x1, y1] = profile[i];
    if (hoursAfter18 <= x1) {
      const [x0, y0] = profile[i - 1];
      return y0 + ((y1 - y0) * (hoursAfter18 - x0)) / (x1 - x0);
    }
  }
  return profile[profile.length - 1][1];
}

const locationAt = (p: Coordinates) =>
  VIEWING_LOCATIONS.find((l) => Math.abs(l.latitude - p.lat) < 1e-3 && Math.abs(l.longitude - p.lon) < 1e-3);

const demoWeather: WeatherProvider = {
  async getHourlyForecast(lat, lon) {
    const id = locationAt({ lat, lon })?.id ?? `${lat.toFixed(2)},${lon.toFixed(2)}`;
    return Array.from({ length: 30 }, (_, i): HourlyWeather => {
      const time = EVENING_18H - 6 * HOUR + i * HOUR;
      const cloud = cloudAt(id, (time - EVENING_18H) / HOUR);
      return {
        time,
        cloudTotal: Math.round(cloud * 100) / 100,
        temperatureC: -3 - 2 * hashUnit(id),
        precipitationMm: cloud > 0.85 ? 0.1 : 0,
        visibilityKm: 35,
        windKph: 12 + 8 * hashUnit(id + "w"),
        gustKph: 20 + 10 * hashUnit(id + "g"),
      };
    });
  },
};

const demoRouting: RoutingProvider = {
  name: "demo",
  async route(origin, destination) {
    const id = locationAt(destination)?.id;
    const fixed = id && haversineKm(origin, REYKJAVIK) < 5 ? DEMO_ROUTES[id] : undefined;
    if (fixed) return { durationMinutes: fixed[0], distanceKm: fixed[1], source: "demo", estimated: false };
    return { ...estimateRoute(origin, destination), source: "demo" };
  },
};

const demoRoads: RoadConditionProvider = {
  async assess(destination): Promise<RoadSafety> {
    const id = locationAt(destination)?.id ?? "";
    const override = ROAD_OVERRIDES[id];
    const status = override?.status ?? "good";
    const description = override?.description ?? "Easily passable along the route";
    return {
      status,
      description,
      segments: [{ id: `demo-${id}`, name: "Demo route", status, description }],
      coverage: "route",
      source: "demo",
      fetchedAt: new Date(DEMO_NOW - 3 * MINUTE).toISOString(),
    };
  },
};

const DEMO_CAMERA: Camera = {
  id: "demo-gjabakki",
  stationId: 0,
  name: "Gjábakki (demo)",
  description: "Gjábakki til norðurs",
  road: "Gjábakkavegur",
  roadNumber: "365",
  latitude: 64.2105,
  longitude: -20.9306,
  imageUrl: "/demo/camera-night.svg",
  directionDegrees: 0,
  facesRoad: false,
};

const demoCameras: CameraProvider = {
  getAllCameras: async () => [DEMO_CAMERA],
  async getNearbyCameras(lat, lon, radiusKm = 30) {
    const distanceKm = Math.round(haversineKm({ lat, lon }, { lat: DEMO_CAMERA.latitude, lon: DEMO_CAMERA.longitude }) * 10) / 10;
    return distanceKm <= radiusKm ? [{ camera: DEMO_CAMERA, metadata: cameraMetadata(DEMO_CAMERA), distanceKm }] : [];
  },
  getCameraImage: async (id) =>
    id === DEMO_CAMERA.id ? { bytes: new Uint8Array(), contentType: "image/svg+xml", lastModified: new Date(DEMO_NOW - 4 * MINUTE).toISOString() } : null,
  getImageTimestamp: async (id) => (id === DEMO_CAMERA.id ? new Date(DEMO_NOW - 4 * MINUTE).toISOString() : undefined),
};

const demoVision: VisionProvider = {
  model: "demo-vision",
  analyze: async (_image, _camera, now) => ({
    usable: true,
    skyVisible: true,
    nighttime: true,
    estimatedCloudCover: 0.15,
    starsVisible: true,
    auroraVisible: false,
    fog: false,
    precipitation: false,
    visibility: "good",
    confidence: 0.72,
    summary: "Dark sky with scattered stars and little cloud above the horizon.",
    analyzedAt: new Date(now).toISOString(),
    model: "demo-vision",
  }),
};

export function demoContext(): EngineContext {
  return {
    providers: {
      aurora: {
        getForecast: async () => ({
          source: "demo",
          fetchedAt: new Date(DEMO_NOW - 5 * MINUTE).toISOString(),
          nights: [{ eveningDate: DEMO_EVENING, activity: 4, moonDescription: "Moon does not rise" }],
        }),
      },
      weather: demoWeather,
      routing: demoRouting,
      roads: demoRoads,
      cameras: demoCameras,
      vision: demoVision,
    },
    locations: VIEWING_LOCATIONS,
    demo: true,
  };
}
