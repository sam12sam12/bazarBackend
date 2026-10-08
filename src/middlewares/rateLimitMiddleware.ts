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
 * Generic per-user rate limiter factory, same in-memory `Map` + cleanup-
 * interval pattern as `authRateLimiter` above, parameterized for routes that
 * need their own window/cap (e.g. upload presigning — every presigned URL
 * is a free write credential against the bucket, so it needs bounding).
 * Keyed by the authenticated user's id (`c.get('user')`), so this must run
 * after `authMiddleware` in the chain.
 */
export function rateLimit({
	windowMs,
	max,
}: {
	windowMs: number
	max: number
}) {
	const hits = new Map<string, { count: number; reset: number }>()

	setInterval(() => {
		const now = Date.now()
		for (const [key, record] of hits) {
			if (now > record.reset) hits.delete(key)
		}
	}, windowMs)

	return async (c: Context, next: Next) => {
		const user = c.get('user') as { id: string } | undefined
		const key = user?.id ?? 'anonymous'
		const now = Date.now()

		const record = hits.get(key) || { count: 0, reset: now + windowMs }
		if (now > record.reset) {
			record.count = 1
			record.reset = now + windowMs
		} else {
			record.count++
		}
		hits.set(key, record)

		if (record.count > max) {
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
