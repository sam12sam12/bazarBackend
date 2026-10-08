import type { Context, Next } from 'hono'

// Simple in-memory storage for rate limiting
const authRateLimit = new Map<string, { count: number; reset: number }>()

// Clean up expired entries every minute to prevent memory leak
setInterval(() => {
	const now = Date.now()
	for (const [key, record] of authRateLimit) {
		if (now > record.reset) authRateLimit.delete(key)
	}
}, 60_000)

/**
 * Rate Limiter for Authentication Routes
 * Limits each IP to a certain number of requests per window.
 */
export const authRateLimiter = async (c: Context, next: Next) => {
	const forwarded = c.req.header('x-forwarded-for')
	const ip = forwarded?.split(',')[0]?.trim() ?? 'anonymous'
	const now = Date.now()
	const windowMs = 15 * 60 * 1000 // 15 minutes
	const max = 50 // limit each IP to 50 requests per windowMs

	const record = authRateLimit.get(ip) || { count: 0, reset: now + windowMs }

	if (now > record.reset) {
		record.count = 1
		record.reset = now + windowMs
	} else {
		record.count++
	}

	authRateLimit.set(ip, record)

	if (record.count > max) {
		return c.json(
			{
				success: false,
				message: 'Too many authentication attempts. Please try again later.',
			},
			429,
		)
	}

	await next()
}

/**
 * In-memory, per-process fixed-window limiter — correct for a single
 * instance, would need a shared store (Redis) behind a load balancer.
 * Buckets for keys that stop being used are evicted by the caller's own
 * `windowMs` interval, same pattern as `authRateLimiter` above.
 *
 * Factored out so the identical bucket check can run both as Hono
 * middleware (`rateLimit` below) and from `wsRouter.ts`, which has no Hono
 * `Context`/`next` to middleware-wrap — a WebSocket's `onMessage` handler
 * calls `consume(userId)` directly instead.
 */
export function createRateLimiter({
	windowMs,
	max,
}: {
	windowMs: number
	max: number
}) {
	const buckets = new Map<string, { count: number; reset: number }>()

	setInterval(() => {
		const now = Date.now()
		for (const [key, record] of buckets) {
			if (now > record.reset) buckets.delete(key)
		}
	}, windowMs)

	// Returns true if this call is within the limit (and counts it), false
	// if it should be rejected. Never throws — callers decide how to
	// surface a rejection (a 429 for HTTP, a plain error frame for a
	// WebSocket).
	function consume(key: string): boolean {
		const now = Date.now()
		const record = buckets.get(key)

		if (!record || now > record.reset) {
			buckets.set(key, { count: 1, reset: now + windowMs })
			return true
		}

		record.count++
		return record.count <= max
	}

	return { consume }
}

/**
 * Generic per-user rate limiter factory, same in-memory bucket as
 * `createRateLimiter` above, exposed as Hono middleware for REST routes
 * that need their own window/cap (e.g. upload presigning — every presigned
 * URL is a free write credential against the bucket, so it needs
 * bounding). Keyed by the authenticated user's id (`c.get('user')`), so
 * this must run after `authMiddleware` in the chain.
 */
export function rateLimit({
	windowMs,
	max,
}: {
	windowMs: number
	max: number
}) {
	const limiter = createRateLimiter({ windowMs, max })

	return async (c: Context, next: Next) => {
		const user = c.get('user') as { id: string } | undefined
		const key = user?.id ?? 'anonymous'

		if (!limiter.consume(key)) {
			return c.json(
				{
					success: false,
					message: 'Too many requests. Please try again later.',
				},
				429,
			)
		}

		await next()
	}
}
