import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { productViews } from '../src/db/schema'
import { getProductIds, getUserIds } from './index'

type InsertProductView = typeof productViews.$inferInsert

const VIEWS_PER_USER = 5

export async function generateProductViewsFakerData() {
	const userIds = await getUserIds()
	const productIds = await getProductIds()

	if (userIds.length === 0 || productIds.length === 0) {
		return
	}

	// Prevent unique constraint violations on repeat seeds by checking existing DB rows
	const existingViews = await db
		.select({
			user_id: productViews.user_id,
			product_id: productViews.product_id,
		})
		.from(productViews)

	const seenPairs = new Set(
		existingViews.map((v) => `${v.user_id}-${v.product_id}`),
	)

	const productViewsFakerData: InsertProductView[] = []

	for (const user_id of userIds) {
		const availableProducts = productIds.filter(
			(product_id) => !seenPairs.has(`${user_id}-${product_id}`),
		)

		const viewedProducts = faker.helpers.arrayElements(
			availableProducts,
			Math.min(VIEWS_PER_USER, availableProducts.length),
		)

		for (const product_id of viewedProducts) {
			seenPairs.add(`${user_id}-${product_id}`)
			productViewsFakerData.push({
				user_id,
				product_id,
				viewed_at: faker.date.recent({ days: 14 }),
			})
		}
	}

	if (productViewsFakerData.length === 0) return

	await db.insert(productViews).values(productViewsFakerData)
}
