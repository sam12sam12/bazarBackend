import type { MiddlewareHandler } from 'hono'

export function deepTrim<T>(val: T): T {
	if (typeof val === 'string') {
		return val.trim().replace(/\s+/g, ' ') as unknown as T
	}
	if (Array.isArray(val)) {
		return val.map(deepTrim) as unknown as T
	}
	if (val !== null && typeof val === 'object') {
		if (val instanceof Date || val instanceof RegExp) {
			return val
		}
		const result: Record<string, unknown> = {}
		for (const key of Object.keys(val)) {
			result[key] = deepTrim((val as Record<string, unknown>)[key])
		}
		return result as unknown as T
	}
	return val
}

/**
 * Middleware to intercept and trim all incoming parameters, queries, and request bodies.
 * Uses Object.defineProperty to reliably override HonoRequest prototype methods.
 */
export const trimMiddleware: MiddlewareHandler = async (c, next) => {
	const req = c.req

	// Wrap c.req.json
	const originalJson = req.json.bind(req)
	Object.defineProperty(req, 'json', {
		value: async () => {
			const data = await originalJson()
			return deepTrim(data)
		},
		configurable: true,
		writable: true,
	})

	// Wrap c.req.parseBody
	const originalParseBody = req.parseBody.bind(req)
	Object.defineProperty(req, 'parseBody', {
		value: async (options?: Parameters<typeof originalParseBody>[0]) => {
			const data = await originalParseBody(options)
			return deepTrim(data)
		},
		configurable: true,
		writable: true,
	})

	// Wrap c.req.query
	const originalQuery = req.query.bind(req)
	Object.defineProperty(req, 'query', {
		value: (key?: string) => {
			if (key !== undefined) {
				const val = originalQuery(key)
				return typeof val === 'string' ? val.trim().replace(/\s+/g, ' ') : val
			}
			return deepTrim(originalQuery())
		},
		configurable: true,
		writable: true,
	})

	// Wrap c.req.queries
	const originalQueries = req.queries.bind(req)
	Object.defineProperty(req, 'queries', {
		value: (key?: string) => {
			if (key !== undefined) {
				const vals = originalQueries(key)
				return vals
					? vals.map((v: string) => v.trim().replace(/\s+/g, ' '))
					: vals
			}
			return deepTrim(originalQueries())
		},
		configurable: true,
		writable: true,
	})

	// Wrap c.req.param
	const originalParam = req.param.bind(req)
	Object.defineProperty(req, 'param', {
		value: (key?: string) => {
			if (key !== undefined) {
				const val = originalParam(key)
				return typeof val === 'string' ? val.trim().replace(/\s+/g, ' ') : val
			}
			return deepTrim(originalParam())
		},
		configurable: true,
		writable: true,
	})

	await next()
}
