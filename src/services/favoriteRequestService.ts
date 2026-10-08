import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { favoriteRequests, productRequests } from '../db/schema'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { requestWith } from './productRequestService'

export const favoriteRequestService = {
	async toggle(userId: string, requestId: number) {
		const request = await db.query.productRequests.findFirst({
			where: eq(productRequests.id, requestId),
			columns: { id: true },
		})
		if (!request) throw ApiError.notFound('Product request not found')

		const existing = await db.query.favoriteRequests.findFirst({
			where: and(
				eq(favoriteRequests.user_id, userId),
				eq(favoriteRequests.request_id, requestId),
			),
		})

		if (existing) {
			await db
				.delete(favoriteRequests)
				.where(
					and(
						eq(favoriteRequests.user_id, userId),
						eq(favoriteRequests.request_id, requestId),
					),
				)
			return { id: requestId, favorited: false }
		}

		await db
			.insert(favoriteRequests)
			.values({ user_id: userId, request_id: requestId })
			.onConflictDoNothing()
		return { id: requestId, favorited: true }
	},

	async getIds(userId: string): Promise<number[]> {
		const rows = await db
			.select({ request_id: favoriteRequests.request_id })
			.from(favoriteRequests)
			.where(eq(favoriteRequests.user_id, userId))
		return rows.map((r) => r.request_id)
	},

	async isFavorited(userId: string, requestId: number): Promise<boolean> {
		const existing = await db.query.favoriteRequests.findFirst({
			where: and(
				eq(favoriteRequests.user_id, userId),
				eq(favoriteRequests.request_id, requestId),
			),
			columns: { id: true },
		})
		return !!existing
	},

	async getFavorites(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(favoriteRequests.user_id, userId)
		const whereCondition = cursor
			? and(
					baseFilter,
					buildCursorFilter(
						{
							created_at: favoriteRequests.favorited_at,
							id: favoriteRequests.request_id,
						},
						cursor,
					),
				)
			: baseFilter

		const rows = await db.query.favoriteRequests.findMany({
			where: whereCondition,
			with: { request: { with: requestWith } },
			orderBy: [
				desc(favoriteRequests.favorited_at),
				desc(favoriteRequests.request_id),
			],
			limit: limit + 1,
		})

		const { list, nextCursor } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.favorited_at, id: r.request_id })),
			limit,
		)
		return { requests: list.map((r) => r.request), nextCursor }
	},
}
