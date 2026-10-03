import { describe, expect, it } from "vitest";

import { sceneryLabel } from "@/lib/scoring/labels";

import { VIEWING_LOCATIONS } from "./viewing-locations";

describe("viewing locations dataset", () => {
  it("has unique ids", () => {
    const ids = VIEWING_LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rates every spot's setting on a 0–1 scale with a short highlight", () => {
    for (const l of VIEWING_LOCATIONS) {
      expect(l.scenery, l.id).toBeGreaterThanOrEqual(0);
      expect(l.scenery, l.id).toBeLessThanOrEqual(1);
      expect(l.highlight.length, l.id).toBeGreaterThan(10);
      expect(l.highlight.length, l.id).toBeLessThanOrEqual(80);
      expect(l.highlight, l.id).not.toMatch(/\.$/);
    }
  });

  it("places every spot on Iceland's band of geomagnetic latitude, with magnetic midnight just after 00 UTC", () => {
    for (const l of VIEWING_LOCATIONS) {
      expect(l.cgmLatitude, l.id).toBeGreaterThanOrEqual(62.5);
      expect(l.cgmLatitude, l.id).toBeLessThanOrEqual(66.5);
      expect(l.magneticMidnightUtc, l.id).toBeGreaterThanOrEqual(0);
      expect(l.magneticMidnightUtc, l.id).toBeLessThan(1);
    }
  });

  it("puts the north coast closer to the auroral oval than the south coast", () => {
    const cgm = (id: string) => VIEWING_LOCATIONS.find((l) => l.id === id)!.cgmLatitude;
    expect(cgm("husavik")).toBeGreaterThan(cgm("thingvellir"));
    expect(cgm("thingvellir")).toBeGreaterThan(cgm("vik"));
    expect(cgm("kirkjufell")).toBeGreaterThan(cgm("grotta"));
  });

  it("offers iconic spots across the regions visitors stay in", () => {
    const iconicRegions = new Set(VIEWING_LOCATIONS.filter((l) => sceneryLabel(l.scenery) === "Iconic spot").map((l) => l.region));
    for (const region of ["Golden Circle", "South Coast", "Southeast", "Snæfellsnes", "North"]) expect(iconicRegions).toContain(region);
  });
});
