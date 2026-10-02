export const USER_AGENT = "AuroraIceland/0.1 (northern-lights viewing planner)";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${safeUrl(url)}`);
    this.name = "HttpError";
  }
}

/** Strip query strings so tokens never end up in logs or error messages. */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export async function fetchWithTimeout(
  url: string,
  { timeoutMs = 8000, headers, ...init }: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new HttpError(response.status, url);
  return response;
}

export async function fetchJson(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<unknown> {
  return (await fetchWithTimeout(url, init)).json();
}

export async function fetchText(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<string> {
  return (await fetchWithTimeout(url, init)).text();
}

/** Short, safe description for status panels and API errors — never echoes upstream content. */
export function describeError(error: unknown): string {
  if (error instanceof HttpError) return `upstream returned HTTP ${error.status}`;
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "request timed out";
    if (error.name === "ZodError" || error instanceof SyntaxError) return "unexpected response format";
    if (error.name === "BudgetExceededError") return "temporarily rate-limited";
    if (error.name === "TypeError") return "network error";
  }
  return "temporarily unavailable";
}

/** Server-side log line for a failed provider (message only; URLs are already stripped of query strings). */
export function logProviderError(source: string, error: unknown): void {
  console.warn(`[aurora] ${source} unavailable: ${error instanceof Error ? error.message : String(error)}`);
}
