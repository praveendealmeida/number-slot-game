// ---------------------------------------------------------------------------
// Minimal in-memory sliding-window rate limiter.
//
// This is intentionally dependency-free and process-local. On a
// single-instance deployment (or Vercel's per-region warm lambdas) it
// meaningfully slows down brute-force/credential-stuffing attempts against
// auth endpoints. It is NOT a substitute for a shared store in a
// horizontally-scaled, multi-region deployment — if/when this app scales
// across many concurrent serverless instances, replace this with a shared
// backend (e.g. Upstash Redis + @upstash/ratelimit) using the same
// `checkRateLimit(key, ...)` call signature so call sites don't need to change.
// ---------------------------------------------------------------------------

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

// Periodically sweep old buckets so this Map doesn't grow unbounded on a
// long-lived process.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweepIfNeeded(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > SWEEP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Sliding-window-ish (fixed-window, reset-on-expiry) rate limiter.
 *
 * @param key Unique key for the caller/action, e.g. `mobile-auth:<ip>`.
 * @param limit Max requests allowed within the window.
 * @param windowMs Window size in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepIfNeeded(now);

  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - existing.windowStart),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/**
 * Best-effort client IP extraction for use as a rate-limit key. Trusts
 * standard proxy headers (Vercel/most reverse proxies set these); falls back
 * to a constant so requests without any identifying header still share a
 * (conservative) global bucket instead of bypassing rate limiting entirely.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}
