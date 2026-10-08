import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { productReviews, storeReviews } from '../src/db/schema'
import { getProductIds, getStoreIds, getUserIds } from './index'

type ProductReviewInsert = typeof productReviews.$inferInsert
type StoreReviewInsert = typeof storeReviews.$inferInsert

export async function generateProductReviewsFakerData(count = 20) {
	const userIds = await getUserIds()
	const productIds = await getProductIds()

	if (userIds.length === 0 || productIds.length === 0) {
		return
	}

	const productReviewsFakerData: ProductReviewInsert[] = []
	const seenPairs = new Set<string>()

	// Prevent unique constraint violation on repeat seeds by checking existing DB reviews
	const existingReviews = await db
		.select({
			user_id: productReviews.user_id,
			product_id: productReviews.product_id,
		})
		.from(productReviews)

	for (const r of existingReviews) {
		seenPairs.add(`${r.user_id}-${r.product_id}`)
	}

	const maxPossible = userIds.length * productIds.length - seenPairs.size
	count = Math.min(count, maxPossible)

	let attempts = 0
	const maxAttempts = count * 10

	while (productReviewsFakerData.length < count && attempts < maxAttempts) {
		attempts++
		const user_id = faker.helpers.arrayElement(userIds)
		const product_id = faker.helpers.arrayElement(productIds)
		const pairKey = `${user_id}-${product_id}`

		if (!seenPairs.has(pairKey)) {
			seenPairs.add(pairKey)

			const imageCount = faker.number.int({ min: 0, max: 3 })
			const images = Array.from({ length: imageCount }, () =>
				faker.image.urlPicsumPhotos(),
			)

			productReviewsFakerData.push({
				user_id,
				product_id,
				rating: faker.number.int({ min: 1, max: 5 }),
				comment: faker.lorem.paragraph(),
				images,
				is_active: true,
			})
		}
	}

	if (productReviewsFakerData.length === 0) {
		return
	}

	await db.insert(productReviews).values(productReviewsFakerData)
}

export async function generateStoreReviewsFakerData(count = 20) {
	const userIds = await getUserIds()
	const storeIds = await getStoreIds()

	if (userIds.length === 0 || storeIds.length === 0) {
		return
	}

	const storeReviewsFakerData: StoreReviewInsert[] = []
	const seenPairs = new Set<string>()

	// Prevent unique constraint violation on repeat seeds by checking existing DB reviews
	const existingReviews = await db
		.select({ user_id: storeReviews.user_id, store_id: storeReviews.store_id })
		.from(storeReviews)

	for (const r of existingReviews) {
		seenPairs.add(`${r.user_id}-${r.store_id}`)
	}

	const maxPossible = userIds.length * storeIds.length - seenPairs.size
	count = Math.min(count, maxPossible)

	let attempts = 0
	const maxAttempts = count * 10

	while (storeReviewsFakerData.length < count && attempts < maxAttempts) {
		attempts++
		const user_id = faker.helpers.arrayElement(userIds)
		const store_id = faker.helpers.arrayElement(storeIds)
		const pairKey = `${user_id}-${store_id}`

		if (!seenPairs.has(pairKey)) {
			seenPairs.add(pairKey)

			const imageCount = faker.number.int({ min: 0, max: 2 })
			const images = Array.from({ length: imageCount }, () =>
				faker.image.urlPicsumPhotos(),
			)

			storeReviewsFakerData.push({
				user_id,
				store_id,
				rating: faker.number.int({ min: 1, max: 5 }),
				comment: faker.lorem.paragraph(),
				images,
				is_active: true,
			})
		}
	}

	if (storeReviewsFakerData.length === 0) {
		return
	}

	await db.insert(storeReviews).values(storeReviewsFakerData)
}
