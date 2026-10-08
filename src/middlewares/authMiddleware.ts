import type { Context, Next } from 'hono'
import { auth } from '../lib/auth'
import { ApiError } from '../utils/ApiError'

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>

const SESSION_TTL = 60_000 // 1 minute

const sessionCache = new Map<
	string,
	{ data: SessionResult; expiresAt: number }
>()

// Evict stale entries so the map doesn't grow unbounded.
setInterval(() => {
	const now = Date.now()
	for (const [key, entry] of sessionCache) {
		if (entry.expiresAt <= now) sessionCache.delete(key)
	}
}, SESSION_TTL)

async function resolveSession(headers: Headers): Promise<SessionResult> {
	const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
	if (token) {
		const cached = sessionCache.get(token)
		if (cached && cached.expiresAt > Date.now()) return cached.data
	}

	const data = await auth.api.getSession({ headers })

	if (token) {
		sessionCache.set(token, { data, expiresAt: Date.now() + SESSION_TTL })
	}
	return data
}

export const authMiddleware = async (c: Context, next: Next) => {
	const session = await resolveSession(c.req.raw.headers)

	if (!session) {
		return c.json({ success: false, message: 'Unauthorized' }, 401)
	}

	c.set('user', session.user)
	c.set('session', session.session)
	await next()
}

export const adminMiddleware = async (c: Context, next: Next) => {
	const user = c.get('user') as { role?: string } | undefined
	if (user?.role !== 'admin') throw ApiError.forbidden()
	await next()
}

export const optionalAuth = async (c: Context, next: Next) => {
	const session = await resolveSession(c.req.raw.headers)

	if (session) {
		c.set('user', session.user)
		c.set('session', session.session)
	}

	await next()
}
