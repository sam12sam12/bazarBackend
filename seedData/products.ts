import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { products } from '../src/db/schema'
import { getCategoryIds, getProvinceIds, getStoreIds } from './index'

type InsertProductRow = typeof products.$inferInsert

export function createRandomProduct(params: {
	storeIds: number[]
	categoryIds: number[]
	provinceIds: number[]
	created_at?: Date
}): InsertProductRow {
	const store_id = faker.helpers.arrayElement(params.storeIds)
	const category_id = faker.helpers.arrayElement(params.categoryIds)
	const province_id = faker.helpers.arrayElement(params.provinceIds)
	const title = faker.commerce.productName()
	const description = faker.commerce.productDescription()

	// ~40% of products are on sale. For those, `compare_at_price` is the
	// original price and `price` is the discounted price derived from it —
	// matching how the create-product form computes discountedPrice from
	// price + discountPercentage (see ProductBasicInfoStep.tsx).
	const hasDiscount = faker.datatype.boolean({ probability: 0.4 })
	let price: string
	let compare_at_price: string | null = null
	let off_percentage: number | null = null

	if (hasDiscount) {
		const originalPrice = faker.number.int({ min: 1, max: 10000 })
		off_percentage = faker.number.int({ min: 5, max: 70 })
		const discountedPrice = Math.round(
			originalPrice - (originalPrice * off_percentage) / 100,
		)
		price = discountedPrice.toString()
		compare_at_price = originalPrice.toString()
	} else {
		price = faker.number.int({ min: 1, max: 10000 }).toString()
	}

	const currency = faker.helpers.arrayElement(['AFN', 'USD'] as const)
	const quantity = faker.number.int({ min: 0, max: 100 })
	const condition = faker.helpers.arrayElement(['new', 'used'] as const)
	const is_active = true
	const featured = faker.datatype.boolean()
	const is_negotiable = faker.datatype.boolean()
	const delivery_available = faker.datatype.boolean()
	const view_count = faker.number.int({ min: 0, max: 1000 })
	const favorite_count = faker.number.int({ min: 0, max: 100 })

	const imageCount = faker.number.int({ min: 1, max: 5 })
	const images = Array.from({ length: imageCount }, (_, i) => ({
		url: faker.image.urlPicsumPhotos(),
		sort_order: i,
		is_primary: i === 0,
	}))

	const specifications: Record<string, string | number | boolean | null> = {
		brand: faker.company.name(),
		color: faker.color.human(),
		weight: `${faker.number.int({ min: 100, max: 5000 })}g`,
	}

	return {
		store_id,
		category_id,
		province_id,
		title,
		description,
		price,
		compare_at_price,
		off_percentage,
		currency,
		quantity,
		condition,
		is_active,
		featured,
		is_negotiable,
		delivery_available,
		view_count,
		favorite_count,
		images,
		specifications,
		created_at: params.created_at ?? faker.date.past({ years: 1 }),
	}
}

export async function generateProductsFakerData(count = 10) {
	const storeIds = await getStoreIds()
	const categoryIds = await getCategoryIds()
	const provinceIds = await getProvinceIds()

	const productsFakerData: InsertProductRow[] = faker.helpers.multiple(
		() =>
			createRandomProduct({
				storeIds,
				categoryIds,
				provinceIds,
			}),
		{
			count,
		},
	)

	await db.insert(products).values(productsFakerData)
}
