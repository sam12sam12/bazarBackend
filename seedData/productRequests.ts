import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { productRequests } from '../src/db/schema'
import { getCategoryIds, getProvinceIds, getUserIds } from './index'

type InsertProductRequestRow = typeof productRequests.$inferInsert

const REQUEST_STATUSES = ['open', 'resolved', 'closed'] as const

export function createRandomProductRequest(params: {
	userIds: string[]
	categoryIds: number[]
	provinceIds: number[]
}): InsertProductRequestRow {
	const user_id = faker.helpers.arrayElement(params.userIds)
	const category_id = faker.helpers.arrayElement(params.categoryIds)
	// Province is optional (null = "anywhere")
	const province_id = faker.datatype.boolean({ probability: 0.8 })
		? faker.helpers.arrayElement(params.provinceIds)
		: null

	const title = `Looking for ${faker.commerce.productName()}`
	const description = faker.commerce.productDescription()
	const currency = faker.helpers.arrayElement(['AFN', 'USD'] as const)

	// Optional budget range — keep min <= max when present.
	let budget_min: string | null = null
	let budget_max: string | null = null
	if (faker.datatype.boolean({ probability: 0.7 })) {
		const min = faker.number.int({ min: 100, max: 5000 })
		const max = min + faker.number.int({ min: 0, max: 5000 })
		budget_min = min.toString()
		budget_max = max.toString()
	}

	// Optional reference images.
	const imageCount = faker.number.int({ min: 0, max: 3 })
	const images = Array.from({ length: imageCount }, (_, i) => ({
		url: faker.image.urlPicsumPhotos(),
		sort_order: i,
		is_primary: i === 0,
	}))

	const status = 'open' as const satisfies (typeof REQUEST_STATUSES)[number]

	return {
		user_id,
		category_id,
		province_id,
		title,
		description,
		budget_min,
		budget_max,
		currency,
		images,
		status,
		created_at: faker.date.past({ years: 1 }),
	}
}

export async function generateProductRequestsFakerData(count = 20) {
	const userIds = await getUserIds()
	const categoryIds = await getCategoryIds()
	const provinceIds = await getProvinceIds()

	if (userIds.length === 0) {
		console.warn('⚠️  No users found — skipping product requests seed.')
		return
	}
	if (categoryIds.length === 0) {
		console.warn('⚠️  No categories found — skipping product requests seed.')
		return
	}

	const productRequestsFakerData: InsertProductRequestRow[] =
		faker.helpers.multiple(
			() =>
				createRandomProductRequest({
					userIds,
					categoryIds,
					provinceIds,
				}),
			{ count },
		)

	await db.insert(productRequests).values(productRequestsFakerData)
}
