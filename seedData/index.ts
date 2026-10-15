import { sql } from 'drizzle-orm'
import { db } from '../src/db/db'
import {
	categories,
	categoryAttribute,
	products,
	provinces,
	stores,
	users,
} from '../src/db/schema'
import type { CategoryName } from '../src/db/schema/categorySchema'

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

export type LeafCategory = {
	id: number
	path: string
	name: CategoryName
	// gates whether a product in this category can turn on delivery at all
	// (false for real estate, vehicles, ...) — see productSchema's own
	// delivery_available comment.
	delivery: boolean
}

// Leaf categories only (`parent_id` set) — a product or store should never
// be filed directly under a root department ("Electronics"), only one of
// its real subcategories ("Mobiles"), matching what CreateProductScreen's
// nested department→subcategory picker actually lets a seller choose.
// Returns `path`/`name`/`delivery` alongside `id`: `path` because a store's
// own `path` column mirrors whichever category it's assigned (see
// storeService.create — seeding it disconnected from the picked category,
// like the old generator did, left `stores.path` pointing at ltree labels
// that don't exist in the real tree); `name`/`delivery` so a product's own
// title and delivery_available can be genuinely category-appropriate
// instead of generic/random regardless of what category got picked.
export async function getLeafCategories(): Promise<LeafCategory[]> {
	return db
		.select({
			id: categories.id,
			path: categories.path,
			name: categories.name,
			delivery: categories.delivery,
		})
		.from(categories)
		.where(sql`${categories.parent_id} is not null`)
		.orderBy(sql`random()`)
}

export type CategoryAttributeRow = {
	id: number
	category_id: number
	code: string
	label: CategoryName
	type: string
	placeholder: CategoryName | null
	menu_data: { value: string; label: CategoryName }[] | null
	multiple: boolean
	required: boolean
}

// Every category_attribute row, grouped by `category_id` — fetched once per
// seed run and reused across every product, instead of one query per
// product. Only the ~19 leaf categories from the plan's "first pass" (see
// categories.ts) have any rows; everything else maps to an empty array, same
// as a real category with no attributes defined yet.
export async function getCategoryAttributesByCategory(): Promise<
	Map<number, CategoryAttributeRow[]>
> {
	const rows = await db
		.select({
			id: categoryAttribute.id,
			category_id: categoryAttribute.category_id,
			code: categoryAttribute.code,
			label: categoryAttribute.label,
			type: categoryAttribute.type,
			placeholder: categoryAttribute.placeholder,
			menu_data: categoryAttribute.menu_data,
			multiple: categoryAttribute.multiple,
			required: categoryAttribute.required,
		})
		.from(categoryAttribute)

	const byCategory = new Map<number, CategoryAttributeRow[]>()
	for (const row of rows) {
		const existing = byCategory.get(row.category_id)
		if (existing) existing.push(row)
		else byCategory.set(row.category_id, [row])
	}
	return byCategory
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
