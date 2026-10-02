import { describe, expect, it } from "vitest";

import { cameraMetadata, normaliseCameras, parseCameraView } from "./irca-cameras";

describe("parseCameraView", () => {
  it("reads the viewing direction from IRCA's Icelandic descriptions", () => {
    expect(parseCameraView("Hellisheiði séð til vesturs", "Hellisheiði").directionDegrees).toBe(270);
    expect(parseCameraView("Gjábakki til norðurs", "Gjábakki").directionDegrees).toBe(0);
    expect(parseCameraView("Þrengslavegur séð í norður", "Þrengslavegamót").directionDegrees).toBe(0);
    expect(parseCameraView("Kambar neðst séð upp brekku í austur", "Kambar neðst").directionDegrees).toBe(90);
    expect(parseCameraView("Vatnsskarð til norðvesturs", "Vatnsskarð").directionDegrees).toBe(315);
  });

  it("does not mistake road names for directions", () => {
    expect(parseCameraView("Suðurlandsvegur", "Sandskeið").directionDegrees).toBeUndefined();
  });

  it("flags cameras pointed down at the road as not useful for aurora", () => {
    const view = parseCameraView("Hellisheiði séð niður á veg", "Hellisheiði");
    expect(view.facesRoad).toBe(true);
  });
});

describe("normaliseCameras / cameraMetadata", () => {
  const raw = [
    { Maelist_nr: 7001, Myndavel: "Hellisheiði", Vegheiti: "Hringvegur", NrVegur: "1", Skyring: "Hellisheiði séð niður á veg", Slod: "https://www.vegagerdin.is/vgdata/vefmyndavelar/hellisheidi_2.jpg", PntX: 0, PntY: 0, Breidd: 64.0183, Lengd: -21.3426 },
    { Maelist_nr: 7079, Myndavel: "Gjábakki", Vegheiti: null, NrVegur: "365", Skyring: "Gjábakki til norðurs", Slod: "https://www.vegagerdin.is/vgdata/vefmyndavelar/gjabakki_3.jpg", PntX: 0, PntY: 0, Breidd: 64.21, Lengd: -21.0 },
  ];

  it("normalises the official feed and derives stable ids from image names", () => {
    const [down, north] = normaliseCameras(raw);
    expect(down.id).toBe("hellisheidi_2");
    expect(north.id).toBe("gjabakki_3");
    expect(cameraMetadata(down).usefulForAurora).toBe(false);
    expect(cameraMetadata(north)).toMatchObject({ usefulForAurora: true, directionDegrees: 0 });
  });

  it("rejects feeds with a broken shape", () => {
    expect(() => normaliseCameras([{ foo: 1 }])).toThrow();
  });

  it("drops cameras whose image URL is not IRCA over HTTPS, so the proxy can't be pointed elsewhere", () => {
    const poisoned = [
      { ...raw[0], Slod: "http://www.vegagerdin.is/vgdata/vefmyndavelar/a.jpg" },
      { ...raw[0], Slod: "https://evil.example/vegagerdin.is/b.jpg" },
      { ...raw[0], Slod: "https://vegagerdin.is.evil.example/c.jpg" },
      raw[1],
    ];
    expect(normaliseCameras(poisoned).map((c) => c.id)).toEqual(["gjabakki_3"]);
  });
});
