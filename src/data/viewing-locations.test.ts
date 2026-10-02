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

  it("offers iconic spots across the regions visitors stay in", () => {
    const iconicRegions = new Set(VIEWING_LOCATIONS.filter((l) => sceneryLabel(l.scenery) === "Iconic spot").map((l) => l.region));
    for (const region of ["Golden Circle", "South Coast", "Southeast", "Snæfellsnes", "North"]) expect(iconicRegions).toContain(region);
  });
});
