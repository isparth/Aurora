import { describe, expect, it } from "vitest";

import { REYKJAVIK } from "@/data/towns";
import { recommend } from "@/features/recommendations/engine";

import { DEMO_NOW, demoContext } from "./demo-providers";

const run = () => recommend({ origin: { ...REYKJAVIK, label: "Reykjavík" }, travelMode: "standard", now: DEMO_NOW }, demoContext());

describe("demo scenario (/results?demo=true)", () => {
  it("is deterministic and needs no network", async () => {
    expect(JSON.stringify(await run())).toBe(JSON.stringify(await run()));
  });

  it("shows what the README promises: Þingvellir on top, Strandarkirkja ruled out by its closed road", async () => {
    const res = await run();
    expect(res.recommendations[0].location.id).toBe("thingvellir");
    expect(res.recommendations[0].label).toBe("Excellent");
    expect(res.notRecommended.map((r) => [r.location.id, r.blockedBy])).toContainEqual(["strandarkirkja", "road"]);
    expect(res.aurora).toMatchObject({ source: "nowcast", available: true });
  });
});
