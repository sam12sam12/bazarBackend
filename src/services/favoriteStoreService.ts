import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { favoriteStores, stores } from '../db/schema'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'

export const favoriteStoreService = {
	async toggle(userId: string, storeId: number) {
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, storeId),
			columns: { id: true },
		})
		if (!store) throw ApiError.notFound('Store not found')

		const existing = await db.query.favoriteStores.findFirst({
			where: and(
				eq(favoriteStores.user_id, userId),
				eq(favoriteStores.store_id, storeId),
			),
		})

		if (existing) {
			await db
				.delete(favoriteStores)
				.where(
					and(
						eq(favoriteStores.user_id, userId),
						eq(favoriteStores.store_id, storeId),
					),
				)
			return { id: storeId, favorited: false }
		}

		await db
			.insert(favoriteStores)
			.values({ user_id: userId, store_id: storeId })
			.onConflictDoNothing()
		return { id: storeId, favorited: true }
	},

	async getIds(userId: string): Promise<number[]> {
		const rows = await db
			.select({ store_id: favoriteStores.store_id })
			.from(favoriteStores)
			.where(eq(favoriteStores.user_id, userId))
		return rows.map((r) => r.store_id)
	},

	async isFavorited(userId: string, storeId: number): Promise<boolean> {
		const existing = await db.query.favoriteStores.findFirst({
			where: and(
				eq(favoriteStores.user_id, userId),
				eq(favoriteStores.store_id, storeId),
			),
			columns: { id: true },
		})
		return !!existing
	},

	async getFavorites(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(favoriteStores.user_id, userId)
		const whereCondition = cursor
			? and(
					baseFilter,
					buildCursorFilter(
						{
							created_at: favoriteStores.favorited_at,
							id: favoriteStores.store_id,
						},
						cursor,
					),
				)
			: baseFilter

		const rows = await db.query.favoriteStores.findMany({
			where: whereCondition,
			with: {
				store: {
					columns: {
						id: true,
						name: true,
						logo_url: true,
						owner_id: true,
						is_active: true,
						product_count: true,
						approval_status: true,
					},
					with: {
						province: { columns: { name: true, code: true } },
					},
				},
			},
			orderBy: [
				desc(favoriteStores.favorited_at),
				desc(favoriteStores.store_id),
			],
			limit: limit + 1,
		})

		const { list, nextCursor } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.favorited_at, id: r.store_id })),
			limit,
		)
		return {
			// Every row here is already filtered to `userId`'s own favorites —
			// `isSave` is trivially true for all of them. `isOwner` still needs
			// the real per-row check (you can favorite your own store) — only
			// fetched `owner_id` to compute it, so it's stripped before return,
			// same as `StoreResponse`'s shape everywhere else.
			stores: list
				.map((r) => r.store)
				.filter((s): s is NonNullable<typeof s> => s?.is_active === true)
				.map(({ owner_id, ...store }) => ({
					...store,
					isOwner: owner_id === userId,
					isSave: true,
				})),
			nextCursor,
		}
	},
}
