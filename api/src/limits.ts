// A fixed-window rate limiter kept in memory. One process serves the app, so
// a Map is enough; it forgets everything on restart, which is acceptable for
// a demo. The Map never holds more than maxKeys entries.
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetsAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(limit: number, windowMs = 60_000, maxKeys = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** Counts one request for key; returns how many seconds to wait, or 0 if it may go ahead. */
  take(key: string, now = Date.now()): number {
    let window = this.windows.get(key);
    if (!window || window.resetsAt <= now) {
      if (this.windows.size >= this.maxKeys) this.forgetExpired(now);
      window = { count: 0, resetsAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    return window.count > this.limit ? Math.ceil((window.resetsAt - now) / 1000) : 0;
  }

  private forgetExpired(now: number) {
    for (const [key, window] of this.windows) if (window.resetsAt <= now) this.windows.delete(key);
    // Still full of live windows: start over rather than grow without bound.
    if (this.windows.size >= this.maxKeys) this.windows.clear();
  }
}
