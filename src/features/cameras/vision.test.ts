import { afterEach, describe, expect, it, vi } from "vitest";

import type { Camera } from "@/domain/types";

import { createOpenAiCompatibleVision, selectVisionProvider } from "./vision";

const camera: Camera = {
  id: "gjabakki_3",
  stationId: 7079,
  name: "Gjábakki",
  description: "Gjábakki til norðurs",
  latitude: 64.21,
  longitude: -21.0,
  imageUrl: "https://www.vegagerdin.is/vgdata/vefmyndavelar/gjabakki_3.jpg",
  facesRoad: false,
};
const image = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg", lastModified: "2026-10-02T22:00:00.000Z" };

function mockCompletion(content: string) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible vision provider", () => {
  const vision = createOpenAiCompatibleVision({ apiKey: "test-key", baseUrl: "https://example.test/v1", model: "test-model" });

  it("sends the image as a low-detail data URL and asks for JSON", async () => {
    const fetchMock = mockCompletion(JSON.stringify({ usable: true, skyVisible: true, estimatedCloudCover: 0.2, auroraVisible: false, confidence: 0.8 }));
    await vision.analyze(image, camera, Date.parse("2026-10-02T22:05:00Z"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content[1].image_url).toEqual({ url: "data:image/jpeg;base64,AQID", detail: "low" });
  });

  it("returns a validated observation", async () => {
    mockCompletion(JSON.stringify({ usable: true, skyVisible: true, estimatedCloudCover: 0.15, starsVisible: true, auroraVisible: true, confidence: 0.7, summary: "  Clear,   green arc low in the north. " }));
    const obs = await vision.analyze(image, camera, Date.now());
    expect(obs).toMatchObject({ usable: true, auroraVisible: true, estimatedCloudCover: 0.15, confidence: 0.7, model: "test-model" });
    expect(obs.summary).toBe("Clear, green arc low in the north.");
  });

  it("rejects malformed or out-of-range model output instead of trusting it", async () => {
    mockCompletion(JSON.stringify({ usable: true, skyVisible: true, confidence: 7 }));
    await expect(vision.analyze(image, camera, Date.now())).rejects.toThrow();
    mockCompletion("not json at all");
    await expect(vision.analyze(image, camera, Date.now())).rejects.toThrow();
  });

  it("is disabled unless VISION_API_KEY is configured", () => {
    expect(selectVisionProvider({} as NodeJS.ProcessEnv)).toBeNull();
    expect(selectVisionProvider({ VISION_API_KEY: "k", VISION_MODEL: "m" } as unknown as NodeJS.ProcessEnv)?.model).toBe("m");
  });
});
