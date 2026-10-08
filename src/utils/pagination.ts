import { and, type Column, eq, lt, or, type SQL } from 'drizzle-orm'
import type { Context } from 'hono'
import { z } from 'zod'
import { ApiError } from './ApiError'

export interface CursorData {
	created_at: string
	id: string | number
}

const cursorSchema = z.object({
	created_at: z.string().datetime(),
	id: z.union([z.string(), z.number()]),
})

export function parseCursor(cursor?: string): CursorData | undefined {
	if (!cursor) return undefined
	try {
		const result = cursorSchema.safeParse(JSON.parse(cursor))
		return result.success ? result.data : undefined
	} catch {
		return undefined
	}
}

// Builds the cursor-based WHERE condition for (created_at DESC, id DESC) pagination.
// Pass idTransform=String for tables with UUID primary keys (e.g. users).
export function buildCursorFilter(
	table: { created_at: Column; id: Column },
	cursor: CursorData,
	idTransform: (v: string | number) => string | number = Number,
): SQL {
	return or(
		lt(table.created_at, new Date(cursor.created_at)),
		and(
			eq(table.created_at, new Date(cursor.created_at)),
			lt(table.id, idTransform(cursor.id)),
		),
	) as SQL
}

// Slices results to the requested limit, derives nextCursor and hasMore.
export function paginateResults<
	T extends { created_at: Date; id: string | number },
>(results: T[], limit: number) {
	const hasMore = results.length > limit
	const list = hasMore ? results.slice(0, limit) : results
	const lastItem = list[list.length - 1]
	const nextCursor =
		hasMore && lastItem
			? { created_at: lastItem.created_at.toISOString(), id: lastItem.id }
			: null
	return { list, nextCursor, hasMore }
}

// Parses a numeric route param and throws 400 if it is missing or non-positive.
export function parseId(c: Context, param = 'id'): number {
	const id = Number(c.req.param(param))
	if (Number.isNaN(id) || id <= 0) throw ApiError.badRequest(`Invalid ${param}`)
	return id
}

// Parses a uuid route param and throws 400 if it isn't a well-formed uuid.
export function parseUuid(c: Context, param: string): string {
	const value = c.req.param(param)
	if (!value || !z.string().uuid().safeParse(value).success) {
		throw ApiError.badRequest(`Invalid ${param}`)
	}
	return value
}
