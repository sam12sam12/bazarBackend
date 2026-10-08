import type { Context, Next } from 'hono'
import type { ZodSchema } from 'zod'
import { ApiError } from '../utils/ApiError.ts'

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
		} catch (e) {
			console.log(e)
			throw ApiError.badRequest('Invalid request format')
		}

		const result = schema.safeParse(data)

		if (!result.success) {
			throw ApiError.badRequest('Validation failed', result.error.format())
		}

		// Pass the validated data to the context for easy access in controllers
		c.set('validated', result.data)
		await next()
	}
}
