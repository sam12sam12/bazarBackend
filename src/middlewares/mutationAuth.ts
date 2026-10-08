import type { Context, Next } from 'hono'
import { authMiddleware } from './authMiddleware.ts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Public reads, authenticated writes.
 *
 * GET/HEAD/OPTIONS pass straight through — catalogue browsing (categories,
 * product feed, stores, reviews…) needs no session. Anything that mutates
 * (POST/PUT/PATCH/DELETE) is forced through `authMiddleware`, so the client
 * gets a 401 and can send the user to the sign-in screen.
 *
 * User-scoped GET endpoints (e.g. `/users/me`, `/orders`) must still add
 * `authMiddleware` explicitly on their own route.
 */
export const mutationAuth = async (c: Context, next: Next) => {
	if (SAFE_METHODS.has(c.req.method)) return next()
	return authMiddleware(c, next)
}
