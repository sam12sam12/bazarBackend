import { type Column, type SQL, sql } from 'drizzle-orm'
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

// The one tie-break order every cursor-paginated list uses — spread this
// into `.orderBy(...)` instead of repeating `desc(created_at), desc(id)` per
// resource.
//
// `nulls last` is spelled out explicitly rather than just `desc(column)`,
// because drizzle-kit's DDL generator always canonicalizes a schema index's
// `.desc()` into `DESC NULLS LAST` — but the query-side `desc()` helper
// emits plain `DESC`, which Postgres defaults to `NULLS FIRST` for. That
// mismatch is invisible on a small table (the planner just sorts everything
// either way) but at real scale it means the planner can't recognize the
// index already provides this order, so it falls back to a full scan + sort
// instead of walking the index and stopping at `limit`. Both columns are
// `NOT NULL` so the actual null ordering never matters — what matters is
// that this matches the paired index byte-for-byte (see e.g.
// `messages_conversation_pagination_idx`).
export function cursorOrderBy(table: { created_at: Column; id: Column }) {
	return [
		sql`${table.created_at} desc nulls last`,
		sql`${table.id} desc nulls last`,
	] as const
}

// Builds the cursor-based WHERE condition for (created_at DESC, id DESC)
// pagination, as a native Postgres row-value comparison — `(created_at, id)
// < (cursor_created_at, cursor_id)` — not the logically-equivalent
// `lt(created_at, x) OR (eq(created_at, x) AND lt(id, y))` decomposition.
// That looks identical but the planner can't push it down as a bounded
// `Index Cond`; it only ever shows up as a `Filter`, so every row from the
// cursor to the end of the table gets fetched and checked one by one. On a
// small table that's free. At 1,000,000 rows, a cursor 500,000 rows deep
// takes ~730ms and touches every remaining row that way — the row-value
// form the planner *can* bound gets the same query down to ~13ms.
// Pass idTransform=String for tables with UUID primary keys (e.g. users).
export function buildCursorFilter(
	table: { created_at: Column; id: Column },
	cursor: CursorData,
	idTransform: (v: string | number) => string | number = Number,
): SQL {
	return sql`(${table.created_at}, ${table.id}) < (${new Date(cursor.created_at)}, ${idTransform(cursor.id)})`
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
