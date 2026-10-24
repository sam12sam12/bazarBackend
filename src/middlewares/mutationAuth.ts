import type { Context, Next } from 'hono'
import { authMiddleware } from './authMiddleware.ts'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// The handful of writes that are deliberately public — this runs *before*
// any router, so a route omitting `authMiddleware` on its own (e.g.
// pushTokenRouter's `/anonymous`) is still blocked here unless it's also
// listed in this set. Keep this list to true anonymous-device use cases,
// not a general escape hatch.
const PUBLIC_MUTATION_PATHS = new Set(['/api/v1/push-tokens/anonymous'])

/**
 * Public reads, authenticated writes.
 *
 * GET/HEAD/OPTIONS pass straight through — catalogue browsing (categories,
 * product feed, stores, reviews…) needs no session. Anything that mutates
 * (POST/PUT/PATCH/DELETE) is forced through `authMiddleware`, so the client
 * gets a 401 and can send the user to the sign-in screen — except the
 * narrow `PUBLIC_MUTATION_PATHS` allowlist above.
 *
 * User-scoped GET endpoints (e.g. `/users/me`, `/orders`) must still add
 * `authMiddleware` explicitly on their own route.
 */
export const mutationAuth = async (c: Context, next: Next) => {
	if (SAFE_METHODS.has(c.req.method)) return next()
	if (PUBLIC_MUTATION_PATHS.has(c.req.path)) return next()
	return authMiddleware(c, next)
}
