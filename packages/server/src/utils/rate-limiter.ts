import type { Context, Next } from "hono";

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Message sent in the 429 response body. */
  message?: string;
}

interface WindowRecord {
  count: number;
  resetAt: number;
}

/**
 * Create a lightweight in-memory sliding-window rate limiter middleware for Hono.
 *
 * Keyed by the client IP address (X-Forwarded-For → X-Real-IP → "unknown").
 * Returns HTTP 429 with a Retry-After header when the limit is exceeded.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, message = "Too many requests, please try again later." } = options;

  const store = new Map<string, WindowRecord>();

  // Periodically evict stale entries to prevent unbounded memory growth.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store) {
      if (record.resetAt < now) store.delete(key);
    }
  }, windowMs);

  // Allow Jest / Node to exit without waiting for the timer.
  if (cleanup.unref) cleanup.unref();

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const now = Date.now();
    const record = store.get(ip);

    if (!record || record.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
    } else {
      record.count += 1;
      if (record.count > maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        c.header("Retry-After", String(retryAfter));
        return c.json({ error: message }, 429);
      }
    }

    await next();
  };
}
