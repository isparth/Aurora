import { describe, expect, it } from "vitest";

import type { Coordinates, RoadStatus } from "@/domain/types";
import { bboxOf, polylineLengthKm } from "@/lib/geo";

import { assessRoad, type RoadNetwork, type RoadSegment } from "./route-matching";
import { normaliseRoadCondition } from "./status";

const line = (from: Coordinates, to: Coordinates, steps = 20): Coordinates[] =>
  Array.from({ length: steps + 1 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / steps, lon: from.lon + ((to.lon - from.lon) * i) / steps }));

const segment = (id: string, status: RoadStatus, path: Coordinates[], description = "Easily passable"): RoadSegment => ({
  id,
  name: `Road ${id}`,
  status,
  description,
  lines: [path],
  bbox: bboxOf(path),
  lengthKm: polylineLengthKm(path),
});

// A straight 20 km east–west route, and a north–south road crossing it in the middle.
const routePath = line({ lat: 64.0, lon: -21.4 }, { lat: 64.0, lon: -21.0 });
const crossing = line({ lat: 63.95, lon: -21.2 }, { lat: 64.05, lon: -21.2 });
const destination = { lat: 64.0, lon: -21.0 };
const network = (segments: RoadSegment[]): RoadNetwork => ({ segments, fetchedAt: "2026-10-02T20:00:00Z", source: "irca" });

describe("normaliseRoadCondition", () => {
  it("maps IRCA codes to safety levels and lets weather notes only make things worse", () => {
    expect(normaliseRoadCondition("GREIDFAERT", null)).toBe("good");
    expect(normaliseRoadCondition("HALKUBLETTIR", null)).toBe("caution");
    expect(normaliseRoadCondition("THUNGFAERT", null)).toBe("difficult");
    expect(normaliseRoadCondition("LOKAD", "ALLUR_AKSTUR_BANN")).toBe("closed");
    expect(normaliseRoadCondition("GREIDFAERT", "STORHRID")).toBe("difficult");
    expect(normaliseRoadCondition("HALKA", "STEINKAST")).toBe("caution");
    expect(normaliseRoadCondition("SOMETHING_NEW", null)).toBe("unknown");
  });
});

describe("assessRoad", () => {
  it("reports the worst condition along the route", () => {
    const res = assessRoad(
      network([segment("a", "good", line({ lat: 64.0, lon: -21.4 }, { lat: 64.0, lon: -21.2 })), segment("b", "caution", line({ lat: 64.0, lon: -21.2 }, { lat: 64.0, lon: -21.0 }), "Spots of ice")]),
      destination,
      routePath,
    );
    expect(res.status).toBe("caution");
    expect(res.description).toBe("Spots of ice on Road b");
    expect(res.coverage).toBe("route");
  });

  it("ignores a closed road that only crosses the route", () => {
    const res = assessRoad(network([segment("main", "good", routePath), segment("side", "closed", crossing, "Closed")]), destination, routePath);
    expect(res.status).toBe("good");
  });

  it("detects a closure on the route itself", () => {
    const res = assessRoad(network([segment("main", "closed", routePath, "Impassable")]), destination, routePath);
    expect(res.status).toBe("closed");
  });

  it("says unknown — rather than inventing safety — when nothing covers the drive", () => {
    const far = line({ lat: 65.5, lon: -18 }, { lat: 65.6, lon: -18 });
    const res = assessRoad(network([segment("far", "good", far)]), destination, routePath);
    expect(res.status).toBe("unknown");
    expect(res.coverage).toBe("none");
  });

  it("falls back to roads near the destination when there is no route geometry", () => {
    const res = assessRoad(network([segment("near", "caution", line({ lat: 64.01, lon: -21.05 }, { lat: 64.01, lon: -20.95 }), "Slippery")]), destination, null);
    expect(res.status).toBe("caution");
    expect(res.coverage).toBe("destination");
  });
});
