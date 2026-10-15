import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { productReviews, storeReviews } from '../src/db/schema'
import { getProductIds, getStoreIds, getUserIds } from './index'

type ProductReviewInsert = typeof productReviews.$inferInsert
type StoreReviewInsert = typeof storeReviews.$inferInsert

// Both review photo limits (PRODUCT_REVIEW_PHOTO_LIMIT/STORE_REVIEW_PHOTO_LIMIT
// in the frontend's Schemas/) are 3 — reviews here can have anywhere from
// none up to that cap.
const REVIEW_PHOTO_LIMIT = 3

// A real review's `created_at` varies (faker.date.past below); an owner's
// reply, when there is one, always comes some time after that — not before
// it, and not all bunched at `now()` the way every row used to be.
function maybeOwnerReply(createdAt: Date, probability: number) {
	if (!faker.datatype.boolean({ probability })) {
		return { owner_reply: null, owner_reply_at: null }
	}
	return {
		owner_reply: faker.lorem.sentences({ min: 1, max: 2 }),
		owner_reply_at: faker.date.between({ from: createdAt, to: new Date() }),
	}
}

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

			const imageCount = faker.number.int({ min: 0, max: REVIEW_PHOTO_LIMIT })
			const images = Array.from({ length: imageCount }, () =>
				faker.image.urlPicsumPhotos(),
			)
			const created_at = faker.date.past({ years: 1 })

			productReviewsFakerData.push({
				user_id,
				product_id,
				rating: faker.number.int({ min: 1, max: 5 }),
				comment: faker.lorem.paragraph(),
				images,
				is_active: true,
				created_at,
				// ~40% of reviews already have the selling store's reply —
				// exercises ReplyToProductReviewScreen's edit path and
				// ProductReviewDetailsScreen's reply block without every
				// review needing a manual reply first.
				...maybeOwnerReply(created_at, 0.4),
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

			const imageCount = faker.number.int({ min: 0, max: REVIEW_PHOTO_LIMIT })
			const images = Array.from({ length: imageCount }, () =>
				faker.image.urlPicsumPhotos(),
			)
			const created_at = faker.date.past({ years: 1 })

			storeReviewsFakerData.push({
				user_id,
				store_id,
				rating: faker.number.int({ min: 1, max: 5 }),
				comment: faker.lorem.paragraph(),
				images,
				is_active: true,
				created_at,
				...maybeOwnerReply(created_at, 0.4),
			})
		}
	}

	if (storeReviewsFakerData.length === 0) {
		return
	}

	await db.insert(storeReviews).values(storeReviewsFakerData)
}
