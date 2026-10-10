import { desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { storeViews } from '../db/schema'
import { favoriteStoreService } from './favoriteStoreService'

export const storeViewService = {
	// Upsert — re-viewing a store bumps viewed_at instead of duplicating.
	async recordView(userId: string, storeId: number) {
		await db
			.insert(storeViews)
			.values({ user_id: userId, store_id: storeId })
			.onConflictDoUpdate({
				target: [storeViews.user_id, storeViews.store_id],
				set: { viewed_at: new Date() },
			})
	},

	async getRecent(userId: string, limit = 5) {
		const rows = await db.query.storeViews.findMany({
			where: eq(storeViews.user_id, userId),
			orderBy: [desc(storeViews.viewed_at)],
			limit,
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
		})

		// One extra query for the whole page instead of a per-row subquery —
		// same membership-check `storeService.getFollowedStores`/
		// `favoriteStoreService.getFavorites` use for `isSave`.
		const favoriteIds = new Set(await favoriteStoreService.getIds(userId))
		return rows
			.map((row) => row.store)
			.filter(
				(store): store is NonNullable<typeof store> =>
					store?.is_active === true,
			)
			.map(({ owner_id, ...store }) => ({
				...store,
				isOwner: owner_id === userId,
				isSave: favoriteIds.has(store.id),
			}))
	},
}
