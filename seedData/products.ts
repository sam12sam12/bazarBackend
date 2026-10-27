import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { products } from '../src/db/schema'
import { randomProductImageUrls } from './categoryImages'
import {
	type CategoryAttributeRow,
	getCategoryAttributesByCategory,
	getLeafCategories,
	getProvinceIds,
	getStoreIds,
	type LeafCategory,
} from './index'

type InsertProductRow = typeof products.$inferInsert
type Specs = Record<string, string | string[]>

// Only the few codes a generic 1-100 fallback would look silly for — every
// other "number" attribute (there are none outside this set in the current
// seed data, but a future one would just fall back sensibly) still gets a
// plausible value instead of erroring.
const NUMBER_RANGES: Record<string, [number, number]> = {
	year: [1990, 2026],
	mileage: [0, 300_000],
	area_sqm: [20, 500],
	bedrooms: [1, 6],
	bathrooms: [1, 4],
}

// Category ids from the plan's "first pass" attribute set (see
// seedData/categories.ts) — used below to build a title/description that
// actually reads like the category it's in, not generic commerce noise.
const REAL_ESTATE_LEAVES = new Set([25, 26, 29, 30, 31, 32, 109])
const CLOTHING_LEAVES = new Set([33, 34])
const FURNITURE_LEAVES = new Set([48, 49, 50, 51, 52, 53, 54])

// Mirrors exactly what ProductSpecsStep writes into `categorySpecs.<code>`:
// a `menu` attribute is a single selected `value` string, or a `value[]`
// when `multiple`; `number`/`text` are always plain strings (FormTextField,
// even with a numeric keyboard, still hands back a string).
function randomSpecValue(attribute: CategoryAttributeRow): string | string[] {
	if (attribute.type === 'menu') {
		const options = attribute.menu_data ?? []
		if (options.length === 0) return attribute.multiple ? [] : ''

		if (attribute.multiple) {
			// Weighted toward actually having more than one answer — a single
			// answer never renders ProductVariantsSection's buyer-facing "pick a
			// variant" row (color swatches, RAM/storage chips, ...) at all, see
			// its own `value.length <= 1` guard. Real listings for a `multiple`
			// attribute like Color are also just more often multi-value in
			// practice (a seller stocking a phone model rarely stocks only one
			// color), so this isn't just a UI-coverage nudge.
			const maxCount = Math.min(3, options.length)
			const count = faker.helpers.weightedArrayElement(
				Array.from({ length: maxCount }, (_, i) => {
					const value = i + 1
					return { value, weight: value === 1 ? 30 : 70 / (maxCount - 1 || 1) }
				}),
			)
			return faker.helpers.arrayElements(options, count).map((o) => o.value)
		}
		return faker.helpers.arrayElement(options).value
	}

	if (attribute.type === 'number') {
		const [min, max] = NUMBER_RANGES[attribute.code] ?? [1, 100]
		return faker.number.int({ min, max }).toString()
	}

	// 'text' — only "model" exists in the current seed data (Cars); anything
	// else still gets a plausible short phrase instead of being skipped.
	if (attribute.code === 'model') return faker.vehicle.model()
	return faker.commerce.productAdjective()
}

// One real value per attribute the picked category actually carries — a
// *required* attribute never comes back blank since every attribute (not
// just required ones) gets a value here. Most leaf categories have none
// yet (only the ~19 the plan's first pass covered do), in which case this
// is just `{}`, same as a real listing in any other category.
function buildSpecifications(attributes: CategoryAttributeRow[]): Specs {
	const specifications: Specs = {}
	for (const attribute of attributes) {
		specifications[attribute.code] = randomSpecValue(attribute)
	}
	return specifications
}

// English display label for a stored spec value (specs hold the raw
// machine key, e.g. "samsung" — titles need "Samsung"). Falls back to the
// raw value itself for a "text" attribute (no menu_data to look up).
function labelOf(
	attributes: CategoryAttributeRow[],
	code: string,
	specs: Specs,
): string | undefined {
	const raw = specs[code]
	if (raw == null) return undefined
	const first = Array.isArray(raw) ? raw[0] : raw
	if (first == null) return undefined

	const attribute = attributes.find((a) => a.code === code)
	const match = attribute?.menu_data?.find((o) => o.value === first)
	return match?.label.en ?? first
}

// A title that actually reflects the picked category and its own specs —
// "Samsung Mobiles 128GB", "Toyota Corolla 2018", "3-Bedroom House for
// Sale" — instead of generic, category-blind commerce noise ("Handcrafted
// Cotton Ball" on a phone listing). Every leaf category still gets a
// category-anchored fallback even with no attributes of its own.
function buildTitle(
	category: LeafCategory,
	specs: Specs,
	attributes: CategoryAttributeRow[],
): string {
	const nameEn = category.name.en

	if (category.id === 13 || category.id === 14) {
		// Mobiles / Laptops
		const brand = labelOf(attributes, 'brand', specs)
		const storage = labelOf(attributes, 'storage', specs)
		return [brand, nameEn, storage].filter(Boolean).join(' ')
	}

	if (category.id === 41) {
		// Cars
		const make = labelOf(attributes, 'make', specs)
		const model = typeof specs.model === 'string' ? specs.model : undefined
		const year = typeof specs.year === 'string' ? specs.year : undefined
		return [make, model, year].filter(Boolean).join(' ') || nameEn
	}

	if (REAL_ESTATE_LEAVES.has(category.id)) {
		const bedrooms =
			typeof specs.bedrooms === 'string' ? specs.bedrooms : undefined
		const purpose = labelOf(attributes, 'purpose', specs)
		return [
			bedrooms ? `${bedrooms}-Bedroom` : undefined,
			nameEn,
			// menu_data's own label is already "For Sale"/"For Rent"/"Mortgage" —
			// prepending another "for" would read as "House for For Sale".
			purpose,
		]
			.filter(Boolean)
			.join(' ')
	}

	if (CLOTHING_LEAVES.has(category.id)) {
		const color = labelOf(attributes, 'color', specs)
		const material = labelOf(attributes, 'material', specs)
		return [color, material, nameEn].filter(Boolean).join(' ')
	}

	if (FURNITURE_LEAVES.has(category.id)) {
		const material = labelOf(attributes, 'material', specs)
		return [material, nameEn].filter(Boolean).join(' ')
	}

	// Every other leaf — still names the real category, never a disconnected
	// random noun.
	return `${faker.commerce.productAdjective()} ${nameEn}`
}

function buildDescription(category: LeafCategory, specs: Specs): string {
	const highlights = Object.entries(specs)
		.slice(0, 3)
		.map(
			([code, value]) =>
				`${code}: ${Array.isArray(value) ? value.join('/') : value}`,
		)
		.join(', ')

	const base = faker.commerce.productDescription()
	return highlights ? `${base} (${category.name.en} — ${highlights})` : base
}

export function createRandomProduct(params: {
	storeIds: number[]
	leafCategories: LeafCategory[]
	provinceIds: number[]
	attributesByCategory: Map<number, CategoryAttributeRow[]>
	created_at?: Date
}): InsertProductRow {
	const store_id = faker.helpers.arrayElement(params.storeIds)
	const category = faker.helpers.arrayElement(params.leafCategories)
	const province_id = faker.helpers.arrayElement(params.provinceIds)
	const attributes = params.attributesByCategory.get(category.id) ?? []
	const specifications = buildSpecifications(attributes)

	const title = buildTitle(category, specifications, attributes)
	const description = buildDescription(category, specifications)

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
	const condition = faker.helpers.arrayElement([
		'new',
		'like_new',
		'used',
		'refurbished',
	] as const)

	// listing_status mirrors productController.create, which always sets
	// 'active' on a real publish — most seeded listings are that, with a
	// 'sold'/'expired' slice for variety. No quantity/stock involved —
	// listings here are classifieds-style (one of a kind), not retail
	// inventory; ordersService.checkout marks a product 'sold' directly on
	// purchase rather than decrementing a unit count toward zero.
	const listing_status = faker.helpers.weightedArrayElement([
		{ weight: 85, value: 'active' as const },
		{ weight: 10, value: 'sold' as const },
		{ weight: 5, value: 'expired' as const },
	])
	const is_active = listing_status !== 'expired'

	const featured = faker.datatype.boolean()
	const is_negotiable = faker.datatype.boolean()

	// A category that can't be delivered at all (real estate, ...) never
	// gets delivery_available true — matches useCategoryDelivery gating the
	// wizard's delivery step out of existence for these categories, so a
	// real listing there could never have fee/day fields to begin with.
	const delivery_available = category.delivery && faker.datatype.boolean()
	const intra_city_fee = delivery_available
		? faker.number.int({ min: 50, max: 500 }).toString()
		: null
	const intra_city_days = delivery_available
		? faker.helpers.arrayElement(['1-2 days', '2-3 days', 'Same day'])
		: null
	const inter_province_fee = delivery_available
		? faker.number.int({ min: 300, max: 1500 }).toString()
		: null
	const inter_province_days = delivery_available
		? faker.helpers.arrayElement(['3-5 days', '5-7 days', '1 week'])
		: null

	const view_count = faker.number.int({ min: 0, max: 1000 })
	const favorite_count = faker.number.int({ min: 0, max: 100 })

	const imageUrls = randomProductImageUrls(category.id, category.icon_url, 1)
	const images = imageUrls.map((url, i) => ({
		url,
		sort_order: i,
		is_primary: i === 0,
	}))

	return {
		store_id,
		category_id: category.id,
		province_id,
		title,
		description,
		price,
		compare_at_price,
		off_percentage,
		currency,
		condition,
		listing_status,
		is_active,
		featured,
		is_negotiable,
		delivery_available,
		intra_city_fee,
		intra_city_days,
		inter_province_fee,
		inter_province_days,
		view_count,
		favorite_count,
		images,
		specifications,
		created_at: params.created_at ?? faker.date.past({ years: 1 }),
	}
}

// Postgres caps a single query at 65535 bind params; a product row binds
// ~24 columns, so batching at 1000 rows/insert (24k params) stays well
// clear of that limit no matter how large `count` gets.
const INSERT_BATCH_SIZE = 1000

export async function generateProductsFakerData(count = 10) {
	const storeIds = await getStoreIds()
	const leafCategories = await getLeafCategories()
	const provinceIds = await getProvinceIds()
	const attributesByCategory = await getCategoryAttributesByCategory()

	let inserted = 0
	while (inserted < count) {
		const batchSize = Math.min(INSERT_BATCH_SIZE, count - inserted)
		const batch: InsertProductRow[] = faker.helpers.multiple(
			() =>
				createRandomProduct({
					storeIds,
					leafCategories,
					provinceIds,
					attributesByCategory,
				}),
			{ count: batchSize },
		)

		await db.insert(products).values(batch)
		inserted += batchSize
		console.log(`   …${inserted}/${count} products inserted`)
	}
}
