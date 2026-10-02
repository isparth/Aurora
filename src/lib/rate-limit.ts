/** Fixed-window request counter keyed by client, with bounded memory. */
export function createFixedWindowLimiter({ windowMs = 60_000, maxKeys = 10_000 } = {}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function take(key: string, limit: number, now = Date.now()): { ok: boolean; retryAfter: number } {
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size >= maxKeys) {
        for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfter: 0 };
    }
    bucket.count++;
    return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  };
}
