import { and, type Column, sql, type SQL } from 'drizzle-orm'
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

// The cursor is an opaque base64url token on the wire — the client passes it
// back verbatim, never reads or constructs it (same contract Stripe/GitHub/
// Relay use). Internally it's still just the JSON below.
export function parseCursor(token?: string): CursorData | undefined {
	if (!token) return undefined
	try {
		const json = Buffer.from(token, 'base64url').toString('utf8')
		const result = cursorSchema.safeParse(JSON.parse(json))
		return result.success ? result.data : undefined
	} catch {
		return undefined
	}
}

function encodeCursor(data: CursorData): string {
	return Buffer.from(JSON.stringify(data)).toString('base64url')
}

// The one tie-break order every cursor-paginated list uses — spread this
// into `.orderBy(...)` instead of repeating `desc(created_at), desc(id)`
// per resource.
//
// `NULLS LAST` is spelled out explicitly, not just `desc(column)`, because
// drizzle-kit's DDL generator always canonicalizes a schema index's
// `.desc()` into `DESC NULLS LAST` — but the query-side `desc()` helper
// emits plain `DESC`, which Postgres defaults to `NULLS FIRST` for. That
// mismatch is invisible on a small table (the planner just sorts everything
// either way) but at real scale it means the planner can't recognize the
// index already provides this order, so it falls back to a full scan +
// sort instead of walking the index and stopping at `limit`. Both columns
// are `NOT NULL` so the actual null ordering never matters — what matters
// is that this matches the paired index byte-for-byte.
export function cursorOrderBy(table: { created_at: Column; id: Column }) {
	return [
		sql`${table.created_at} desc nulls last`,
		sql`${table.id} desc nulls last`,
	] as const
}

// Builds the tuple-comparison WHERE condition for (created_at DESC, id DESC)
// pagination, as a native Postgres row-value comparison — `(created_at, id)
// < (cursor_created_at, cursor_id)` — not the equivalent-looking `lt(created_at,
// x) OR (eq(created_at, x) AND lt(id, y))` decomposition. That looks
// identical logically but the planner can't push it down as a bounded
// `Index Cond`; it only ever shows up as a `Filter`, so every row from the
// cursor to the end of the table gets fetched and checked one by one. On a
// small table that's free. At real scale, the row-value form the planner
// *can* bound is dramatically faster.
// Pass idTransform=String for tables with UUID primary keys.
function buildCursorFilter(
	table: { created_at: Column; id: Column },
	cursor: CursorData,
	idTransform: (v: string | number) => string | number = Number,
): SQL {
	return sql`(${table.created_at}, ${table.id}) < (${new Date(cursor.created_at)}, ${idTransform(cursor.id)})`
}

// The one call a paginated list's WHERE clause needs: every other filter
// condition (any mix of `SQL | undefined`, same as a bare `and(...)`), plus
// the cursor if there is one. Saves every caller from writing
// `cursor ? buildCursorFilter(table, cursor) : undefined` by hand.
export function withCursor(
	table: { created_at: Column; id: Column },
	cursor: CursorData | undefined,
	...conditions: (SQL | undefined)[]
) {
	return and(...conditions, cursor ? buildCursorFilter(table, cursor) : undefined)
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
			? encodeCursor({ created_at: lastItem.created_at.toISOString(), id: lastItem.id })
			: null
	return { list, nextCursor, hasMore }
}

// Parses a numeric route param and throws 400 if it is missing or non-positive.
export function parseId(c: Context, param = 'id'): number {
	const id = Number(c.req.param(param))
	if (Number.isNaN(id) || id <= 0) throw ApiError.badRequest(`Invalid ${param}`)
	return id
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Parses a uuid route param (users.id) and throws 400 if it's missing or
// malformed — same reasoning as parseId, but for uuid-keyed tables. Without
// this, a malformed value reaches Postgres as a raw "invalid input syntax
// for type uuid" error instead of a clean 400.
export function parseUuid(c: Context, param = 'id'): string {
	const value = c.req.param(param)
	if (!value || !UUID_REGEX.test(value)) throw ApiError.badRequest(`Invalid ${param}`)
	return value
}
