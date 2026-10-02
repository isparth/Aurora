import { describe, expect, it } from "vitest";

import { createFixedWindowLimiter } from "./rate-limit";

describe("createFixedWindowLimiter", () => {
  it("allows up to the limit per window, then refuses with a retry hint", () => {
    const take = createFixedWindowLimiter({ windowMs: 60_000 });
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(take("ip-a", 3, t0).ok).toBe(true);
    const refused = take("ip-a", 3, t0 + 15_000);
    expect(refused).toEqual({ ok: false, retryAfter: 45 });
    expect(take("ip-b", 3, t0 + 15_000).ok).toBe(true);
  });

  it("resets after the window", () => {
    const take = createFixedWindowLimiter({ windowMs: 1000 });
    take("k", 1, 0);
    expect(take("k", 1, 500).ok).toBe(false);
    expect(take("k", 1, 1000).ok).toBe(true);
  });

  it("keeps memory bounded when many clients appear", () => {
    const take = createFixedWindowLimiter({ windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) take(`ip-${i}`, 5, 0);
    expect(take("ip-999", 1, 1).ok).toBe(false);
  });
});
