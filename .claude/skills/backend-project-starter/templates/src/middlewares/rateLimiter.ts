import type { Context, Next } from "hono";
import { ApiError } from "../utils/ApiError";

interface Bucket {
  count: number;
  windowStart: number;
}

// In-memory, per-process — unlike `lib/chatHub.ts`'s presence map (now
// Redis-backed, see Backend's CLAUDE.md), this one hasn't needed to move yet:
// correct for a single instance, would need a shared store (Redis) behind a
// load balancer. Buckets for users who stop
// making requests are never evicted, so memory grows with total distinct
// callers ever seen, not concurrent ones — an acceptable bound for this
// project's scale, not something a high-traffic deployment should copy
// as-is.
//
// Keyed by the authenticated user's id, never IP — every route this
// middleware can run behind already requires `authMiddleware` first (it
// reads `c.get('user')`), so there's always a stable identity to key by,
// one a client can't rotate the way they could an IP.
//
// Factored out of `rateLimit` (the Hono middleware below) so the identical
// fixed-window bucket check can also run from `wsRouter.ts`, which has no
// Hono `Context`/`next` to middleware-wrap — a WebSocket's `onMessage`
// handler calls `consume(userId)` directly instead.
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  // Returns true if this call is within the limit (and counts it), false if
  // it should be rejected. Never throws — callers decide how to surface a
  // rejection (an ApiError for HTTP, a plain error frame for a WebSocket).
  function consume(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    bucket.count += 1;
    return bucket.count <= max;
  }

  return { consume };
}

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const limiter = createRateLimiter({ windowMs, max });

  return async (c: Context, next: Next) => {
    const key = c.get("user").id;
    if (!limiter.consume(key)) {
      throw ApiError.tooManyRequests("Too many requests — try again in a few minutes");
    }
    await next();
  };
}
