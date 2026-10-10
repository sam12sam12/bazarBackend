import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { productViews, products } from '../db/schema'
import {
	isOwnerColumn,
	isSaveColumn,
	PRODUCT_LIST_COLUMNS,
} from './productService'

export const productViewService = {
	// Upsert — re-viewing a product bumps viewed_at instead of duplicating.
	async recordView(userId: string, productId: number) {
		await db
			.insert(productViews)
			.values({ user_id: userId, product_id: productId })
			.onConflictDoUpdate({
				target: [productViews.user_id, productViews.product_id],
				set: { viewed_at: new Date() },
			})
	},

	async getRecent(userId: string, limit = 5) {
		return db
			.select({
				...PRODUCT_LIST_COLUMNS,
				isSave: isSaveColumn(userId),
				isOwner: isOwnerColumn(userId),
			})
			.from(productViews)
			.innerJoin(products, eq(productViews.product_id, products.id))
			.where(
				and(eq(productViews.user_id, userId), eq(products.is_active, true)),
			)
			.orderBy(desc(productViews.viewed_at))
			.limit(limit)
	},
}
