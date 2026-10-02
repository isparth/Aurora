export class BudgetExceededError extends Error {
  constructor(name: string) {
    super(`${name} request budget exhausted`);
    this.name = "BudgetExceededError";
  }
}

/**
 * Process-wide sliding-window limit on calls to one upstream. Callers treat a refusal like any
 * other provider failure (and fall back), so a flood of unique requests can't hammer — or run up
 * the bill on — an external API.
 */
export function createRateBudget(name: string, maxPerMinute: number): () => void {
  const stamps: number[] = [];
  return () => {
    const now = Date.now();
    while (stamps.length > 0 && now - stamps[0] > 60_000) stamps.shift();
    if (stamps.length >= maxPerMinute) throw new BudgetExceededError(name);
    stamps.push(now);
  };
}
