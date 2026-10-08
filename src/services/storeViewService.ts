import { desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { storeViews } from '../db/schema'

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

		return rows
			.map((row) => row.store)
			.filter(
				(store): store is NonNullable<typeof store> =>
					store?.is_active === true,
			)
	},
}
