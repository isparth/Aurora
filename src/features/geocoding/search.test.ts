import { describe, expect, it } from "vitest";

import { normaliseName, searchLocal } from "./search";

describe("location search", () => {
  it("matches Icelandic names typed without Icelandic letters", () => {
    expect(normaliseName("Þingvellir")).toBe("thingvellir");
    expect(searchLocal("thingv")[0].name).toBe("Þingvellir National Park");
    expect(searchLocal("reykjav")[0].name).toBe("Reykjavík");
    expect(searchLocal("hofn")[0].name).toBe("Höfn");
  });

  it("returns towns before viewing spots and nothing for empty input", () => {
    const results = searchLocal("vik");
    expect(results[0]).toMatchObject({ name: "Vík", kind: "town" });
    expect(searchLocal("   ")).toEqual([]);
  });
});
