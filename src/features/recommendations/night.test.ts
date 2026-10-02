import { describe, expect, it } from "vitest";

import { sunAltitude } from "@/lib/astronomy/darkness";

import { computeNight } from "./night";

const REYKJAVIK = { lat: 64.1466, lon: -21.9426 };
const HUSAVIK = { lat: 66.0449, lon: -17.3389 };
const HOUR = 3_600_000;

describe("computeNight", () => {
  it("finds tonight's dark period from the afternoon, keyed to the evening's date", () => {
    const night = computeNight(REYKJAVIK, Date.UTC(2026, 9, 2, 14, 0))!;
    expect(new Date(night.start).getUTCHours()).toBeGreaterThanOrEqual(19);
    expect(night.eveningDate).toBe("2026-10-02");
    expect(night.darkFrom).not.toBeNull();
  });

  it("keeps the same evening date after midnight", () => {
    expect(computeNight(REYKJAVIK, Date.UTC(2026, 9, 3, 1, 0))!.eveningDate).toBe("2026-10-02");
  });

  it("moves on to the next night when the current one is nearly over", () => {
    const night = computeNight(REYKJAVIK, Date.UTC(2026, 9, 3, 6, 40))!;
    expect(night.eveningDate).toBe("2026-10-03");
  });

  it("covers the whole long winter night in the far north, ending at dawn rather than a cap", () => {
    const night = computeNight(HUSAVIK, Date.UTC(2026, 11, 20, 12, 0))!;
    expect(night.end - night.start).toBeGreaterThan(16 * HOUR);
    expect(sunAltitude(night.end + 15 * 60_000, HUSAVIK)).toBeGreaterThanOrEqual(-6);
  });

  it("returns null in the bright Icelandic summer", () => {
    expect(computeNight(REYKJAVIK, Date.UTC(2026, 5, 21, 12, 0))).toBeNull();
  });
});
