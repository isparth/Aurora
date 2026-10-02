import type {
  AuroraForecast,
  Camera,
  CameraObservation,
  Coordinates,
  HourlyWeather,
  NearbyCamera,
  RoadSafety,
  Route,
} from "./types";

export interface AuroraProvider {
  getForecast(): Promise<AuroraForecast>;
}

export interface WeatherProvider {
  getHourlyForecast(lat: number, lon: number): Promise<HourlyWeather[]>;
  /** Optional batched variant; one entry per point, an Error where that point failed. */
  getHourlyForecasts?(points: Coordinates[]): Promise<(HourlyWeather[] | Error)[]>;
}

export interface RoutingProvider {
  readonly name: Route["source"];
  /** Polite upper bound on parallel requests to this provider. */
  readonly maxConcurrency?: number;
  route(origin: Coordinates, destination: Coordinates): Promise<Route>;
}

export interface RoadConditionProvider {
  /** Road safety for a drive. `path` is the route geometry when known. */
  assess(destination: Coordinates, path: Coordinates[] | null): Promise<RoadSafety>;
  /** Warm the shared network data so per-route assessments are instant. */
  prefetch?(): Promise<void>;
}

export type CameraImage = { bytes: Uint8Array; contentType: string; lastModified?: string };

export interface CameraProvider {
  getAllCameras(): Promise<Camera[]>;
  getNearbyCameras(lat: number, lon: number, radiusKm?: number): Promise<NearbyCamera[]>;
  getCameraImage(cameraId: string): Promise<CameraImage | null>;
  getImageTimestamp?(cameraId: string): Promise<string | undefined>;
}

export interface VisionProvider {
  readonly model: string;
  analyze(image: CameraImage, camera: Camera, now: number): Promise<CameraObservation>;
}
