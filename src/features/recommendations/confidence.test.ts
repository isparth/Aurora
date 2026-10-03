import { describe, expect, it } from "vitest";

import { SCENARIO_WEIGHTS } from "@/lib/scoring/activity";

import { computeConfidence, type ConfidenceInputs } from "./confidence";

const steady: ConfidenceInputs = {
  hoursAhead: 1,
  activitySource: "nowcast",
  scenarioChances: [0.6, 0.62, 0.65, 0.68, 0.7],
  scenarioWeights: SCENARIO_WEIGHTS,
  windowClouds: [0.05, 0.05, 0.06, 0.05],
};

describe("computeConfidence", () => {
  it("is high for a soon, steady window backed by real-time activity data", () => {
    expect(computeConfidence(steady)).toBe("high");
  });

  it("is never high more than four hours ahead, however settled the inputs look", () => {
    expect(computeConfidence({ ...steady, hoursAhead: 5 })).toBe("medium");
  });

  it("drops when the chance swings strongly with the activity scenario", () => {
    expect(computeConfidence({ ...steady, scenarioChances: [0, 0.15, 0.6, 0.95, 1] })).not.toBe("high");
  });

  it("drops when there is no activity forecast at all", () => {
    expect(computeConfidence({ ...steady, activitySource: "typical", windowClouds: [0.3, 0.5, 0.4, 0.6] })).toBe("low");
  });
});
