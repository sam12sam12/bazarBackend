import type { Context, Next } from 'hono'
import type { ZodSchema } from 'zod'
import { ApiError } from '../utils/ApiError'

/**
 * Middleware factory for Zod validation.
 * Supports validating 'json', 'query', or 'param'.
 */
export const validate = (
	schema: ZodSchema,
	target: 'json' | 'query' | 'param' = 'json',
) => {
	return async (c: Context, next: Next) => {
		let data: unknown

		try {
			if (target === 'json') {
				data = await c.req.json()
			} else if (target === 'query') {
				data = c.req.query()
			} else {
				data = c.req.param()
			}
		} catch {
			throw ApiError.badRequest('Invalid request format')
		}

		const result = schema.safeParse(data)

		if (!result.success) {
			throw ApiError.badRequest('Validation failed', result.error.format())
		}

		c.set('validated', result.data)
		await next()
	}
}
