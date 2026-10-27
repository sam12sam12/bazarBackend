import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	lte,
	ne,
	type SQL,
	sql,
} from 'drizzle-orm'
import { db } from '../db/db'
import { categories, productReviews, products, stores } from '../db/schema'
import type { CreateProduct, UpdateProductClient } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { buildFuzzySearch } from '../utils/search'
import { storage } from '../utils/storage/instance'
import type { ProductFilters, ProductImage } from '../utils/types'
import { notificationDispatchService } from './notificationDispatchService'
import { storeService } from './storeService'

export const PRODUCT_LIST_COLUMNS = {
	id: products.id,
	title: products.title,
	description: products.description,
	price: products.price,
	compare_at_price: products.compare_at_price,
	off_percentage: products.off_percentage,
	currency: products.currency,
	created_at: products.created_at,
	image: sql<string>`images->0->>'url'`,
} as const

// Whether `currentUserId` has favorited this row — `false` with no SQL cost
// when there's no signed-in caller. Mirrors `isOwner`'s controller-level
// pattern but as a SQL column, since list rows come straight out of a
// `.select()` rather than a relational query with `with`.
export function isSaveColumn(currentUserId?: string) {
	// `products.id` is deliberately written as literal SQL (not interpolated
	// via the column object) — drizzle renders an interpolated column as a
	// bare, unqualified identifier here, and since `favorite_products` has
	// its own `id` column too, an unqualified `id` inside this subquery
	// would resolve to *that* one instead of correlating to the outer
	// `products` row, silently matching nothing.
	return currentUserId
		? sql<boolean>`EXISTS (SELECT 1 FROM favorite_products WHERE favorite_products.user_id = ${currentUserId} AND favorite_products.product_id = products.id)`
		: sql<boolean>`false`
}

// Whether `currentUserId` owns (via their store) this row — `false` with no
// SQL cost when there's no signed-in caller. Same literal-SQL-correlation
// caveat as `isSaveColumn` above: `products.store_id` is written as plain
// text, not interpolated via the column object.
export function isOwnerColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`EXISTS (SELECT 1 FROM stores WHERE stores.id = products.store_id AND stores.owner_id = ${currentUserId})`
		: sql<boolean>`false`
}

// Buffer view increments and flush in a single UPDATE every 30 s.
const viewBuffer = new Map<number, number>()

async function flushViews() {
	if (viewBuffer.size === 0) return
	const entries = [...viewBuffer.entries()]
	viewBuffer.clear()
	const ids = entries.map(([id]) => id)
	await db
		.update(products)
		.set({
			view_count: sql`CASE ${products.id} ${sql.join(
				entries.map(
					([id, n]) => sql`WHEN ${id} THEN ${products.view_count} + ${n}`,
				),
				sql` `,
			)} ELSE ${products.view_count} END`,
		})
		.where(inArray(products.id, ids))
}

setInterval(flushViews, 30_000)

// The combined tsvector-source (title+description) and the single
// similarity column (title only — see `buildFuzzySearch`'s own comment),
// exactly matching `products_fts_idx`/`products_title_trgm_idx` so both
// stay index-accelerated. Any other entity with a title/description pair
// wanting the same hybrid search builds its own version of this and passes
// it to the shared `buildFuzzySearch` — see `utils/search.ts`.
function productFuzzySearchTarget() {
	return {
		textColumns: [
			sql`coalesce(${products.title}, '')`,
			sql`coalesce(${products.description}, '')`,
		],
		similarityColumn: sql`${products.title}`,
	}
}

async function listProducts(
	baseFilter: SQL | undefined,
	limit: number,
	cursor?: CursorData,
	currentUserId?: string,
) {
	const whereCondition = cursor
		? and(baseFilter, buildCursorFilter(products, cursor))
		: baseFilter

	const results = await db
		.select({
			...PRODUCT_LIST_COLUMNS,
			isSave: isSaveColumn(currentUserId),
			isOwner: isOwnerColumn(currentUserId),
		})
		.from(products)
		.where(whereCondition)
		.orderBy(desc(products.created_at), desc(products.id))
		.limit(limit + 1)

	const {
		list: productList,
		nextCursor,
		hasMore,
	} = paginateResults(results, limit)
	return { products: productList, nextCursor, hasMore }
}

export const productService = {
	// ── Search Suggestions (Minimal data) ──
	async getSuggestions(search: string, limit: number = 10) {
		if (search.length < 1) return []
		const { condition, rank } = buildFuzzySearch(
			search,
			productFuzzySearchTarget(),
		)
		const whereCondition = and(eq(products.is_active, true), condition)
		const results = await db
			.select({
				id: products.id,
				title: products.title,
				image: sql<string>`images->0->>'url'`,
			})
			.from(products)
			.where(whereCondition)
			.orderBy(desc(rank))
			.limit(limit)

		return results
	},

	// ── List with filters ──
	async getAll(filters?: ProductFilters, currentUserId?: string) {
		const conditions: SQL[] = [eq(products.is_active, true)]

		if (filters?.store_id)
			conditions.push(eq(products.store_id, filters.store_id))
		if (filters?.category_id)
			conditions.push(eq(products.category_id, filters.category_id))
		// Match a category subtree (the category itself + all descendants) by ltree path.
		if (filters?.category_path)
			conditions.push(
				sql`${products.category_id} IN (SELECT ${categories.id} FROM ${categories} WHERE ${categories.path} <@ ${filters.category_path}::ltree)`,
			)
		// Multiple department subtrees, OR'd — the browse filter's multi-select
		// category chips (each a department's own ltree path).
		if (filters?.category_paths?.length)
			conditions.push(
				sql`${products.category_id} IN (SELECT ${categories.id} FROM ${categories} WHERE ${categories.path} <@ ANY(ARRAY[${sql.join(
					filters.category_paths.map((p) => sql`${p}::ltree`),
					sql`, `,
				)}]))`,
			)
		if (filters?.province_ids?.length)
			conditions.push(inArray(products.province_id, filters.province_ids))
		if (filters?.listing_status)
			conditions.push(eq(products.listing_status, filters.listing_status))
		if (filters?.condition)
			conditions.push(eq(products.condition, filters.condition))
		if (filters?.min_price)
			conditions.push(gte(products.price, filters.min_price))
		if (filters?.max_price)
			conditions.push(lte(products.price, filters.max_price))
		if (filters?.min_discount)
			conditions.push(gte(products.off_percentage, filters.min_discount))
		if (filters?.featured !== undefined)
			conditions.push(eq(products.featured, filters.featured))

		// Hybrid tsvector+trigram match — see buildFuzzySearch's own comment
		// for why this replaced a strict AND-every-word `plainto_tsquery`
		// match. Any non-empty term applies it (matching getSuggestions'
		// threshold) — skipping the filter below 2 chars used to silently
		// fall through to the unfiltered/default list instead of actually
		// narrowing by what was typed.
		const searchTerm = filters?.search ?? ''
		const hasSearchTerm = searchTerm.length >= 1
		const fuzzySearch = hasSearchTerm
			? buildFuzzySearch(searchTerm, productFuzzySearchTarget())
			: undefined
		if (fuzzySearch) conditions.push(fuzzySearch.condition)

		const limit = filters?.limit || 12
		const sortBy = filters?.sort ?? 'relevance'
		// "Relevance" only means anything with an active search term (ranked by
		// text-match quality); with none it's identical to newest-first, which
		// — like newest-first itself — can page with the shared (created_at,
		// id) cursor. Every other sort orders by a column that cursor knows
		// nothing about, so it pages by plain offset instead (carried in
		// cursor.id, same trick as the product-requests browse filters).
		const usesDefaultCursorOrder = sortBy === 'relevance' && !hasSearchTerm

		if (!usesDefaultCursorOrder) {
			const offset = filters?.cursor ? Number(filters.cursor.id) : 0
			const relevanceRank = fuzzySearch ? fuzzySearch.rank : sql`0`
			const avgRating = sql`(SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = ${products.id})`
			const orderBy =
				sortBy === 'price_asc'
					? [asc(products.price), desc(products.id)]
					: sortBy === 'price_desc'
						? [desc(products.price), desc(products.id)]
						: sortBy === 'rating_desc'
							? [desc(avgRating), desc(products.id)]
							: [
									desc(relevanceRank),
									desc(products.created_at),
									desc(products.id),
								]

			const results = await db
				.select({
					...PRODUCT_LIST_COLUMNS,
					isSave: isSaveColumn(currentUserId),
					isOwner: isOwnerColumn(currentUserId),
				})
				.from(products)
				.where(and(...conditions))
				.orderBy(...orderBy)
				.limit(limit + 1)
				.offset(offset)

			const hasMore = results.length > limit
			const productList = hasMore ? results.slice(0, limit) : results
			const nextCursor = hasMore
				? { created_at: new Date().toISOString(), id: offset + limit }
				: null
			return { products: productList, nextCursor, hasMore }
		}

		if (filters?.cursor) {
			conditions.push(buildCursorFilter(products, filters.cursor) as SQL)
		}

		const results = await db
			.select({
				...PRODUCT_LIST_COLUMNS,
				isSave: isSaveColumn(currentUserId),
				isOwner: isOwnerColumn(currentUserId),
			})
			.from(products)
			.where(and(...conditions))
			.orderBy(desc(products.created_at), desc(products.id))
			.limit(limit + 1)

		const {
			list: productList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { products: productList, nextCursor, hasMore }
	},

	async getPopular(limit: number, cursor?: CursorData, currentUserId?: string) {
		return listProducts(
			eq(products.is_active, true),
			limit,
			cursor,
			currentUserId,
		)
	},

	// General product feed across all categories (currently newest-first) —
	// optionally scoped to one or more provinces (Home screen's own province
	// switcher; "whole Afghanistan" is `undefined`/empty, no filter applied).
	async getFeed(
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
		provinceIds?: number[],
	) {
		const baseFilter = provinceIds?.length
			? and(
					eq(products.is_active, true),
					inArray(products.province_id, provinceIds),
				)
			: eq(products.is_active, true)
		return listProducts(baseFilter, limit, cursor, currentUserId)
	},

	async getGlobal(limit: number, cursor?: CursorData, currentUserId?: string) {
		return listProducts(
			and(eq(products.is_global, true), eq(products.is_active, true)),
			limit,
			cursor,
			currentUserId,
		)
	},

	async getByProvince(
		provinceId: number,
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
	) {
		return listProducts(
			and(eq(products.province_id, provinceId), eq(products.is_active, true)),
			limit,
			cursor,
			currentUserId,
		)
	},

	// ── Lightweight ownership check query ──
	async getByIdWithOwner(id: number) {
		return db.query.products.findFirst({
			where: eq(products.id, id),
			columns: { id: true, store_id: true },
			with: {
				store: {
					columns: { owner_id: true },
				},
			},
		})
	},

	// ── Single product with relations ──
	async getById(id: number) {
		return db.query.products.findFirst({
			where: eq(products.id, id),
			with: {
				store: {
					columns: {
						id: true,
						name: true,
						logo_url: true,
						owner_id: true,
						contact_phone: true,
					},
					with: {
						province: {
							columns: { name: true },
						},
					},
				},
				category: {
					columns: { id: true, name: true },
				},
			},
		})
	},

	// ── Related products (same category, excluding this product) ──
	async getRelated(
		productId: number,
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
	) {
		return listProducts(
			and(
				eq(products.is_active, true),
				ne(products.id, productId),
				sql`${products.category_id} = (SELECT category_id FROM products WHERE id = ${productId})`,
			),
			limit,
			cursor,
			currentUserId,
		)
	},

	// ── Products by store ──
	async getByStoreId(
		storeId: number,
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
	) {
		return listProducts(
			and(eq(products.store_id, storeId), eq(products.is_active, true)),
			limit,
			cursor,
			currentUserId,
		)
	},

	// ── Create product ──
	// Returns the fully hydrated row (same shape as getById) instead of a
	// bare id/message — the frontend writes this straight into its caches
	// (list + detail) instead of refetching after a create.
	async create(data: CreateProduct & { province_id: number }) {
		await storage.validateNewImages(
			(data.images as ProductImage[]).map((i) => i.url),
		)

		const [product] = await db
			.insert(products)
			.values(data)
			.returning({ id: products.id, title: products.title })
		await db
			.update(stores)
			.set({ product_count: sql`${stores.product_count} + 1` })
			.where(eq(stores.id, data.store_id))

		if (!product) return undefined

		this.notifyFollowers(data.store_id, product.id, product.title).catch(
			(err) => console.error('[products] failed to notify followers:', err),
		)

		return this.getById(product.id)
	},

	// ── Background: notify a store's followers of a new product ──
	async notifyFollowers(storeId: number, productId: number, title: string) {
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, storeId),
			columns: { name: true, owner_id: true },
		})
		if (!store) return

		const followerIds = await storeService.getAllFollowerIds(storeId)
		const recipients = followerIds.filter((id) => id !== store.owner_id)
		if (recipients.length === 0) return

		await notificationDispatchService.notifyUsers({
			type: 'new_store_product',
			recipients,
			actorId: store.owner_id,
			productId,
			data: {
				title: 'New Product',
				body: `New listing: ${title}`,
				store_name: store.name,
				product_title: title,
			},
			push: { title: store.name, body: `New listing: ${title}` },
		})
	},

	// ── Update product (partial) ──
	// Same reasoning as create: returns the fully hydrated row so the
	// frontend can patch its caches directly instead of refetching.
	async update(
		id: number,
		data: UpdateProductClient & { province_id?: number },
	) {
		const previous = data.images
			? await db.query.products.findFirst({
					where: eq(products.id, id),
					columns: { images: true },
				})
			: undefined
		const previousUrls = (previous?.images as ProductImage[] | undefined)?.map(
			(i) => i.url,
		)

		if (data.images) {
			await storage.validateNewImages(
				data.images.map((i) => i.url),
				previousUrls ?? [],
			)
		}

		const [updated] = await db
			.update(products)
			.set(data)
			.where(eq(products.id, id))
			.returning({ id: products.id })
		if (!updated) return null

		if (data.images) {
			await storage.reconcileImages(
				previousUrls,
				data.images.map((i) => i.url),
			)
		}
		return this.getById(updated.id)
	},

	// ── Delete product ──
	// Deleting the row cascades (at the DB level, via `products_reviews`'
	// `onDelete: cascade`) straight through every review left on it — that
	// cascade never runs application code, so this is the only place those
	// reviews' own images ever get reconciled; collect them *before* the
	// delete fires, since the rows (and the only record of which urls they
	// held) are gone the instant it does.
	async delete(id: number) {
		const [product, reviews] = await Promise.all([
			db.query.products.findFirst({
				where: eq(products.id, id),
				columns: { store_id: true, images: true },
			}),
			db.query.productReviews.findMany({
				where: eq(productReviews.product_id, id),
				columns: { images: true },
			}),
		])
		await db.delete(products).where(eq(products.id, id))
		if (product) {
			await db
				.update(stores)
				.set({ product_count: sql`GREATEST(${stores.product_count} - 1, 0)` })
				.where(eq(stores.id, product.store_id))
			await storage.reconcileImages(
				(product.images as ProductImage[]).map((i) => i.url),
				[],
			)
			await storage.reconcileImages(
				reviews.flatMap((r) => r.images as string[]),
				[],
			)
		}
		return 'Product deleted successfully'
	},

	// ── JSONB Image management ──
	async addImages(productId: number, newImages: ProductImage[]) {
		await storage.validateNewImages(newImages.map((i) => i.url))

		await db
			.update(products)
			.set({
				images: sql`${products.images} || ${JSON.stringify(newImages)}::jsonb`,
			})
			.where(eq(products.id, productId))
		return 'Images added successfully'
	},

	async removeImage(productId: number, imageUrl: string) {
		const result = await db
			.update(products)
			.set({
				images: sql`COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(${products.images}) AS elem WHERE elem->>'url' != ${imageUrl}), '[]'::jsonb)`,
			})
			.where(eq(products.id, productId))
			.returning({ id: products.id })

		if (!result.length) return null
		await storage.reconcileImage(imageUrl, null)
		return 'Image removed successfully'
	},

	async replaceImages(productId: number, images: ProductImage[]) {
		const previous = await db.query.products.findFirst({
			where: eq(products.id, productId),
			columns: { images: true },
		})
		const previousUrls = (previous?.images as ProductImage[] | undefined)?.map(
			(i) => i.url,
		)

		await storage.validateNewImages(
			images.map((i) => i.url),
			previousUrls ?? [],
		)
		await db.update(products).set({ images }).where(eq(products.id, productId))
		await storage.reconcileImages(
			previousUrls,
			images.map((i) => i.url),
		)
		return 'Images replaced successfully'
	},

	// ── JSONB Specifications management ──
	async updateSpecifications(
		productId: number,
		specifications: Record<string, unknown>,
	) {
		await db
			.update(products)
			.set({ specifications })
			.where(eq(products.id, productId))
		return 'Specifications updated successfully'
	},

	// ── Increment view count (buffered; flushed every 30 s) ──
	incrementViews(id: number) {
		viewBuffer.set(id, (viewBuffer.get(id) ?? 0) + 1)
	},
}
