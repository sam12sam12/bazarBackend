import { sql } from 'drizzle-orm'
import { db } from '../src/db/db'
import {
	categories,
	products,
	provinces,
	stores,
	users,
} from '../src/db/schema'

export async function getUserIds(): Promise<string[]> {
	const getUserIdsData = await db
		.select({ id: users.id })
		.from(users)
		.orderBy(sql`random()`)
		.limit(100)

	const userIds = getUserIdsData.map((u) => u.id)
	return userIds
}

export async function getStoreIds(): Promise<number[]> {
	const getStoreIdsData = await db
		.select({ id: stores.id })
		.from(stores)
		.orderBy(sql`random()`)
		.limit(100)

	const storeIds = getStoreIdsData.map((store) => store.id)
	return storeIds
}

export async function getCategoryIds(): Promise<number[]> {
	const getCategoryIdsDaa = await db
		.select({ id: categories.id })
		.from(categories)
		.orderBy(sql`random()`)

	const categoryIds = getCategoryIdsDaa.map((category) => category.id)
	return categoryIds
}

export async function getProvinceIds(): Promise<number[]> {
	const getProvinceIdsData = await db
		.select({ id: provinces.id })
		.from(provinces)
		.orderBy(sql`random()`)

	const provinceIds = getProvinceIdsData.map((province) => province.id)
	return provinceIds
}

export async function getProductIds(): Promise<number[]> {
	const getProductIdsData = await db
		.select({ id: products.id })
		.from(products)
		.orderBy(sql`random()`)
		.limit(100)

	const productIds = getProductIdsData.map((product) => product.id)
	return productIds
}
