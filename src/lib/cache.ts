type Entry = {
  value?: unknown;
  hasValue: boolean;
  expiresAt: number;
  staleUntil: number;
  pending?: Promise<unknown>;
};

const MAX_ENTRIES = 2000;

/** Survives Next.js dev hot reloads; one cache per server process. */
const globalStore = globalThis as typeof globalThis & { __auroraCache?: Map<string, Entry> };
const store: Map<string, Entry> = (globalStore.__auroraCache ??= new Map());

function evictIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) return;
    store.delete(oldest);
  }
}

export function readCache<T>(key: string, { allowStale = false } = {}): T | undefined {
  const entry = store.get(key);
  if (!entry?.hasValue) return undefined;
  const now = Date.now();
  if (now < entry.expiresAt || (allowStale && now < entry.staleUntil)) return entry.value as T;
  return undefined;
}

export function writeCache<T>(key: string, value: T, ttlMs: number, staleMs = ttlMs * 4): void {
  const now = Date.now();
  store.delete(key);
  store.set(key, { value, hasValue: true, expiresAt: now + ttlMs, staleUntil: now + ttlMs + staleMs });
  evictIfNeeded();
}

/**
 * Read-through cache with in-flight de-duplication. If a refresh fails, a recently expired
 * value is served instead (stale-on-error) so one flaky upstream does not take the app down.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  { staleMs = ttlMs * 4 }: { staleMs?: number } = {},
): Promise<T> {
  const fresh = readCache<T>(key);
  if (fresh !== undefined) return fresh;

  const existing = store.get(key);
  if (existing?.pending) return existing.pending as Promise<T>;

  const pending = loader()
    .then((value) => {
      writeCache(key, value, ttlMs, staleMs);
      return value;
    })
    .catch((error: unknown) => {
      const stale = readCache<T>(key, { allowStale: true });
      const entry = store.get(key);
      if (entry) entry.pending = undefined;
      if (stale !== undefined) return stale;
      throw error;
    });

  const entry: Entry = existing ?? { hasValue: false, expiresAt: 0, staleUntil: 0 };
  entry.pending = pending;
  store.set(key, entry);
  return pending;
}

export function clearCache(): void {
  store.clear();
}
