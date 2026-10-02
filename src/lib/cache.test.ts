import { afterEach, describe, expect, it, vi } from "vitest";

import { cached, clearCache } from "./cache";

afterEach(() => {
  clearCache();
  vi.useRealTimers();
});

describe("cached", () => {
  it("shares one in-flight request between concurrent callers", async () => {
    const loader = vi.fn(async () => "value");
    const [a, b] = await Promise.all([cached("k", 1000, loader), cached("k", 1000, loader)]);
    expect([a, b]).toEqual(["value", "value"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reuses fresh values and reloads after the TTL", async () => {
    vi.useFakeTimers();
    const loader = vi.fn(async () => Date.now());
    const first = await cached("k", 1000, loader);
    expect(await cached("k", 1000, loader)).toBe(first);
    vi.advanceTimersByTime(1500);
    await cached("k", 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("serves the last good value when a refresh fails (stale-on-error)", async () => {
    vi.useFakeTimers();
    await cached("k", 1000, async () => "good");
    vi.advanceTimersByTime(1500);
    expect(await cached("k", 1000, async () => Promise.reject(new Error("upstream down")))).toBe("good");
  });

  it("propagates the error when there is nothing stale to fall back to", async () => {
    await expect(cached("k", 1000, async () => Promise.reject(new Error("down")))).rejects.toThrow("down");
  });

  it("backs off a failing upstream instead of retrying on every request", async () => {
    vi.useFakeTimers();
    const failing = vi.fn(async () => Promise.reject(new Error("down")));
    await expect(cached("k", 60_000, failing)).rejects.toThrow("down");
    await expect(cached("k", 60_000, failing)).rejects.toThrow("down");
    expect(failing).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    await expect(cached("k", 60_000, async () => "recovered")).resolves.toBe("recovered");
  });
});
