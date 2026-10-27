import type { Context } from 'hono'
import { favoriteProductService } from '../services/favoriteProductService.ts'
import { productService } from '../services/productService.ts'
import { productViewService } from '../services/productViewService.ts'
import { storeService } from '../services/storeService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { ProductFilters, ProductSort } from '../utils/types.ts'

const LTREE_LABEL = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/
const SORT_VALUES: ProductSort[] = [
	'relevance',
	'price_asc',
	'price_desc',
	'rating_desc',
]

// "1,2,3" -> [1, 2, 3]; drops non-positive/NaN entries; undefined for empty/missing.
function parseIdList(raw: string | undefined): number[] | undefined {
	if (!raw) return undefined
	const ids = raw
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((id) => Number.isFinite(id) && id > 0)
	return ids.length > 0 ? ids : undefined
}

async function assertProductOwner(
	productId: number,
	currentUser: { id: string; role?: string },
) {
	const product = await productService.getByIdWithOwner(productId)
	if (!product) throw ApiError.notFound('Product not found')
	if (
		product.store.owner_id !== currentUser.id &&
		currentUser.role !== 'admin'
	) {
		throw ApiError.forbidden()
	}
}

export const productController = {
	async getSuggestions(c: Context) {
		const search = c.req.query('q') as string
		if (!search) return c.json({ success: true, data: [] })

		const results = await productService.getSuggestions(search)
		return c.json({ success: true, data: results })
	},

	async getAll(c: Context) {
		const user = c.get('user')
		const query = c.req.query()
		const parsedCursor = parseCursor(query.cursor)
		const limit = 12

		// accept a valid ltree path only (labels of [A-Za-z0-9_-] joined by dots —
		// real category slugs like "real-estate" do contain hyphens)
		const categoryPath =
			query.category_path && LTREE_LABEL.test(query.category_path)
				? query.category_path
				: undefined
		const categoryPaths = query.category_paths
			?.split(',')
			.map((p) => p.trim())
			.filter((p) => LTREE_LABEL.test(p))
		const provinceIds = parseIdList(query.province_ids)
		const minDiscount = query.min_discount
			? Number(query.min_discount)
			: undefined
		const sort = SORT_VALUES.includes(query.sort as ProductSort)
			? (query.sort as ProductSort)
			: undefined

		const filters = {
			store_id: query.store_id ? Number(query.store_id) : undefined,
			category_id: query.category_id ? Number(query.category_id) : undefined,
			category_path: categoryPath,
			category_paths: categoryPaths?.length ? categoryPaths : undefined,
			province_ids: provinceIds,
			listing_status: query.listing_status || undefined,
			condition: query.condition || undefined,
			min_price: query.min_price || undefined,
			max_price: query.max_price || undefined,
			min_discount:
				minDiscount !== undefined && minDiscount > 0 ? minDiscount : undefined,
			featured:
				query.featured !== undefined ? query.featured === 'true' : undefined,
			search: query.search || undefined,
			sort,
			limit,
			cursor: parsedCursor,
		} as ProductFilters
		const result = await productService.getAll(filters, user?.id)
		return c.json({ success: true, data: result })
	},

	async getGlobal(c: Context) {
		const user = c.get('user')
		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const result = await productService.getGlobal(limit, parsedCursor, user?.id)
		return c.json({ success: true, data: result })
	},

	// Popular feed across all categories (currently newest-first).
	async getPopular(c: Context) {
		const user = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))

		const result = await productService.getPopular(limit, cursor, user?.id)
		return c.json({ success: true, data: result })
	},

	// General product feed across all categories (currently newest-first) —
	// optionally scoped to the Home screen's province switcher.
	async getFeed(c: Context) {
		const user = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))
		const provinceIds = parseIdList(c.req.query('province_ids'))

		const result = await productService.getFeed(
			limit,
			cursor,
			user?.id,
			provinceIds,
		)
		return c.json({ success: true, data: result })
	},

	async getByProvince(c: Context) {
		const user = c.get('user')
		const provinceId = parseId(c, 'provinceId')
		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const result = await productService.getByProvince(
			provinceId,
			limit,
			parsedCursor,
			user?.id,
		)
		return c.json({ success: true, data: result })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const product = await productService.getById(id)
		if (!product) throw ApiError.notFound('Product not found')

		productService.incrementViews(id)

		const user = c.get('user')
		if (user) {
			productViewService
				.recordView(user.id, id)
				.catch((err) =>
					console.error('[product-view] failed to record view:', err),
				)
		}

		const isOwner = user ? product.store.owner_id === user.id : false
		const isSave = user
			? await favoriteProductService.isFavorited(user.id, id)
			: false
		return c.json({ success: true, data: { ...product, isOwner, isSave } })
	},

	async getRelated(c: Context) {
		const user = c.get('user')
		const id = parseId(c)
		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const result = await productService.getRelated(
			id,
			limit,
			parsedCursor,
			user?.id,
		)
		return c.json({ success: true, data: result })
	},

	async getByStore(c: Context) {
		const user = c.get('user')
		const storeId = parseId(c, 'storeId')
		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const result = await productService.getByStoreId(
			storeId,
			limit,
			parsedCursor,
			user?.id,
		)
		return c.json({ success: true, data: result })
	},

	async create(c: Context) {
		const data = c.get('validated')
		const currentUser = c.get('user') as { id: string; role?: string }

		const store = await storeService.getById(data.store_id)
		if (!store) throw ApiError.notFound('Store not found')
		if (store.owner_id !== currentUser.id && currentUser.role !== 'admin') {
			throw ApiError.forbidden()
		}

		// A product's province is always its store's — never taken from the
		// client (see createProductSchema's comment). New listings go live
		// immediately; there's no draft-saving step in the create flow.
		const product = await productService.create({
			...data,
			province_id: store.province_id,
			listing_status: 'active',
		})
		if (!product) throw ApiError.notFound('Product not found')
		// Brand new — nobody could have favorited it before it existed, and
		// the creator always owns it, so both are known without a query.
		return c.json(
			{ success: true, data: { ...product, isOwner: true, isSave: false } },
			201,
		)
	},

	async update(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(id, currentUser)

		const data = c.get('validated')

		// Re-derive province_id if the edit reassigns the listing to a
		// different one of the seller's stores — same server-side rule as
		// create, and re-checked for ownership since `assertProductOwner`
		// above only verified the *current* store, not the target one.
		let province_id: number | undefined
		if (data.store_id !== undefined) {
			const store = await storeService.getById(data.store_id)
			if (!store) throw ApiError.notFound('Store not found')
			if (store.owner_id !== currentUser.id && currentUser.role !== 'admin') {
				throw ApiError.forbidden()
			}
			province_id = store.province_id
		}

		const product = await productService.update(id, { ...data, province_id })
		if (!product) throw ApiError.notFound('Product not found')
		const isOwner = product.store.owner_id === currentUser.id
		const isSave = await favoriteProductService.isFavorited(
			currentUser.id,
			product.id,
		)
		return c.json({ success: true, data: { ...product, isOwner, isSave } })
	},

	async delete(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(id, currentUser)

		await productService.delete(id)
		return c.json({ success: true, message: 'Product deleted successfully' })
	},

	// ── JSONB Image endpoints ──
	async addImages(c: Context) {
		const productId = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(productId, currentUser)

		const images = c.get('validated')
		const result = await productService.addImages(productId, images)
		if (!result) throw ApiError.notFound('Product not found')
		return c.json({ success: true, data: result }, 201)
	},

	async removeImage(c: Context) {
		const productId = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(productId, currentUser)

		const { url } = c.get('validated')
		const result = await productService.removeImage(productId, url)
		if (!result) throw ApiError.notFound('Product not found')
		return c.json({ success: true, data: result })
	},

	async replaceImages(c: Context) {
		const productId = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(productId, currentUser)

		const images = c.get('validated')
		const result = await productService.replaceImages(productId, images)
		if (!result) throw ApiError.notFound('Product not found')
		return c.json({ success: true, data: result })
	},

	// ── JSONB Specifications endpoint ──
	async updateSpecifications(c: Context) {
		const productId = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertProductOwner(productId, currentUser)

		const specifications = c.get('validated')
		const result = await productService.updateSpecifications(
			productId,
			specifications,
		)
		if (!result) throw ApiError.notFound('Product not found')
		return c.json({ success: true, data: result })
	},
}
