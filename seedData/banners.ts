import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { banners } from '../src/db/schema'
import type { InsertBanner } from '../src/db/validation'
import {
	getCategoryIds,
	getProductIds,
	getProvinceIds,
	getStoreIds,
} from './index'

export function createRandomBanner(params: {
	productIds: number[]
	categoryIds: number[]
	storeIds: number[]
	provinceIds: number[]
	sortOrder: number
}): InsertBanner {
	const type = faker.helpers.arrayElement([
		'product',
		'category',
		'store',
		'external',
	] as const)
	const is_global = faker.datatype.boolean()
	const province_id = is_global
		? null
		: faker.helpers.arrayElement(params.provinceIds)

	let product_id: number | null = null
	let category_id: number | null = null
	let store_id: number | null = null
	let link: string | null = null

	if (type === 'product' && params.productIds.length > 0) {
		product_id = faker.helpers.arrayElement(params.productIds)
	} else if (type === 'category' && params.categoryIds.length > 0) {
		category_id = faker.helpers.arrayElement(params.categoryIds)
	} else if (type === 'store' && params.storeIds.length > 0) {
		store_id = faker.helpers.arrayElement(params.storeIds)
	} else if (type === 'external') {
		link = faker.internet.url()
	} else {
		// Fallback to external link if specific IDs are empty
		link = faker.internet.url()
	}

	return {
		title: `${faker.commerce.productName()} Promo`,
		description: faker.commerce.productDescription(),
		image_url: faker.image.urlPicsumPhotos({ width: 1200, height: 400 }),
		type,
		product_id,
		category_id,
		store_id,
		link,
		is_global,
		province_id,
		sort_order: params.sortOrder,
		is_active: faker.datatype.boolean(),
	}
}

export async function generateBannersFakerData() {
	const productIds = await getProductIds()
	const categoryIds = await getCategoryIds()
	const storeIds = await getStoreIds()
	const provinceIds = await getProvinceIds()

	const bannersFakerData: InsertBanner[] = Array.from({ length: 10 }, (_, i) =>
		createRandomBanner({
			productIds,
			categoryIds,
			storeIds,
			provinceIds,
			sortOrder: i + 1,
		}),
	)

	await db.insert(banners).values(bannersFakerData)
}
