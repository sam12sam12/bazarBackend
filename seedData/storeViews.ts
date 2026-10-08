import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { storeViews } from '../src/db/schema'
import { getStoreIds, getUserIds } from './index'

type InsertStoreView = typeof storeViews.$inferInsert

const VIEWS_PER_USER = 5

export async function generateStoreViewsFakerData() {
	const userIds = await getUserIds()
	const storeIds = await getStoreIds()

	if (userIds.length === 0 || storeIds.length === 0) {
		return
	}

	// Prevent unique constraint violations on repeat seeds by checking existing DB rows
	const existingViews = await db
		.select({
			user_id: storeViews.user_id,
			store_id: storeViews.store_id,
		})
		.from(storeViews)

	const seenPairs = new Set(
		existingViews.map((v) => `${v.user_id}-${v.store_id}`),
	)

	const storeViewsFakerData: InsertStoreView[] = []

	for (const user_id of userIds) {
		const availableStores = storeIds.filter(
			(store_id) => !seenPairs.has(`${user_id}-${store_id}`),
		)

		const viewedStores = faker.helpers.arrayElements(
			availableStores,
			Math.min(VIEWS_PER_USER, availableStores.length),
		)

		for (const store_id of viewedStores) {
			seenPairs.add(`${user_id}-${store_id}`)
			storeViewsFakerData.push({
				user_id,
				store_id,
				viewed_at: faker.date.recent({ days: 14 }),
			})
		}
	}

	if (storeViewsFakerData.length === 0) return

	await db.insert(storeViews).values(storeViewsFakerData)
}
