import { and, desc, eq, gte, inArray, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import {
	categories,
	productReviews,
	products,
	provinces,
	storeFollows,
	storeReviews,
	stores,
	users,
} from '../db/schema'
import type { CreateStore, UpdateStore } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { buildFuzzySearch } from '../utils/search'
import { storage } from '../utils/storage/instance'
import type { ProductImage, StoreFilters } from '../utils/types'
import { favoriteStoreService } from './favoriteStoreService'
import { notificationDispatchService } from './notificationDispatchService'

// The combined tsvector-source (name+description) and the single similarity
// column (name only) — same hybrid-search shape `productFuzzySearchTarget`
// builds for products, just this entity's own columns.
function storeFuzzySearchTarget() {
	return {
		textColumns: [
			sql`coalesce(${stores.name}, '')`,
			sql`coalesce(${stores.description}, '')`,
		],
		similarityColumn: sql`${stores.name}`,
	}
}

// Whether `currentUserId` has favorited this row — `false` with no SQL cost
// when there's no signed-in caller. Mirrors `isOwner`'s controller-level
// pattern but as a SQL column, for rows coming out of a `.select()`.
//
// `stores.id` is deliberately written as literal SQL (not interpolated via
// the column object) — drizzle renders an interpolated column as a bare,
// unqualified identifier here, and since `favorite_stores` has its own `id`
// column too, an unqualified `id` inside this subquery would resolve to
// *that* one instead of correlating to the outer `stores` row, silently
// matching nothing.
export function isSaveColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`EXISTS (SELECT 1 FROM favorite_stores WHERE favorite_stores.user_id = ${currentUserId} AND favorite_stores.store_id = stores.id)`
		: sql<boolean>`false`
}

// Whether `currentUserId` owns this row — no subquery needed (unlike
// `isSaveColumn`/products' `isOwnerColumn`) since `owner_id` already lives
// directly on `stores`, not a joined table.
export function isOwnerColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`${stores.owner_id} = ${currentUserId}`
		: sql<boolean>`false`
}

// Whether `currentUserId` follows this row — same correlated-subquery shape
// as `isSaveColumn`, just against `store_follows` instead of
// `favorite_stores`.
export function isFollowColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`EXISTS (SELECT 1 FROM store_follows WHERE store_follows.user_id = ${currentUserId} AND store_follows.store_id = stores.id)`
		: sql<boolean>`false`
}

// Live review count + average rating for a listing row — same correlated
// subquery shape `getAll`'s own `min_rating` filter and `rating_desc` sort
// already use inline, just exposed as actual output columns here instead of
// only ever feeding a WHERE/ORDER BY. `getById` computes the same two
// numbers via a separate join+aggregate query instead (see below) since
// that one only ever runs for a single row.
function reviewStatsColumns() {
	return {
		review_count: sql<number>`(SELECT COUNT(*)::int FROM store_reviews WHERE store_id = ${stores.id})`,
		average_rating: sql<number>`COALESCE(ROUND((SELECT AVG(rating) FROM store_reviews WHERE store_id = ${stores.id})::numeric, 2), 0)`,
	}
}

export const storeService = {
	async getSuggestions(search: string, limit: number = 10) {
		if (search.length < 1) return []
		const { condition, rank } = buildFuzzySearch(
			search,
			storeFuzzySearchTarget(),
		)
		const whereCondition = and(eq(stores.is_active, true), condition)

		const results = await db
			.select({
				id: stores.id,
				name: stores.name,
				logo_url: stores.logo_url,
			})
			.from(stores)
			.where(whereCondition)
			.orderBy(desc(rank))
			.limit(limit)

		return results
	},

	async getAll(filters?: StoreFilters, currentUserId?: string) {
		const conditions: SQL[] = [eq(stores.is_active, true)]

		if (filters?.category_id) {
			conditions.push(eq(stores.category_id, filters.category_id))
		}
		// A store's own `path` mirrors its category's ltree path (set at
		// creation), so a multi-department filter matches directly against it
		// — no join through `categories` needed, unlike products.
		if (filters?.category_paths?.length) {
			conditions.push(
				sql`${stores.path} <@ ANY(ARRAY[${sql.join(
					filters.category_paths.map((p) => sql`${p}::ltree`),
					sql`, `,
				)}])`,
			)
		}
		if (filters?.province_id) {
			conditions.push(eq(stores.province_id, filters.province_id))
		}
		if (filters?.province_ids?.length) {
			conditions.push(inArray(stores.province_id, filters.province_ids))
		}
		if (filters?.min_rating) {
			conditions.push(
				gte(
					sql`(SELECT COALESCE(AVG(rating), 0) FROM store_reviews WHERE store_id = ${stores.id})`,
					filters.min_rating,
				),
			)
		}
		if (filters?.verified_only) {
			conditions.push(eq(stores.approval_status, 'approved'))
		}

		const searchTerm = filters?.search ?? ''
		const hasSearchTerm = searchTerm.length >= 1
		const fuzzySearch = hasSearchTerm
			? buildFuzzySearch(searchTerm, storeFuzzySearchTarget())
			: undefined
		if (fuzzySearch) conditions.push(fuzzySearch.condition)

		const limit = filters?.limit || 12
		const sortBy = filters?.sort ?? 'relevance'
		// Same trick as products/requests: "relevance" with no search term is
		// just newest-first, which pages fine with the shared (created_at, id)
		// cursor. Every other sort orders by a column the cursor knows nothing
		// about, so it pages by plain offset instead (carried in cursor.id).
		const usesDefaultCursorOrder = sortBy === 'relevance' && !hasSearchTerm

		if (!usesDefaultCursorOrder) {
			const offset = filters?.cursor ? Number(filters.cursor.id) : 0
			const relevanceRank = fuzzySearch ? fuzzySearch.rank : sql`0`
			const followerCount = sql`(SELECT COUNT(*) FROM store_follows WHERE store_follows.store_id = ${stores.id})`
			const avgRating = sql`(SELECT COALESCE(AVG(rating), 0) FROM store_reviews WHERE store_id = ${stores.id})`
			const orderBy =
				sortBy === 'rating_desc'
					? [desc(avgRating), desc(stores.id)]
					: sortBy === 'products_desc'
						? [desc(stores.product_count), desc(stores.id)]
						: sortBy === 'followers_desc'
							? [desc(followerCount), desc(stores.id)]
							: [desc(relevanceRank), desc(stores.created_at), desc(stores.id)]

			const rows = await db
				.select({
					id: stores.id,
					name: stores.name,
					owner_id: stores.owner_id,
					category_id: stores.category_id,
					description: stores.description,
					is_active: stores.is_active,
					address: stores.address,
					province_id: stores.province_id,
					logo_url: stores.logo_url,
					banner_url: stores.banner_url,
					approval_status: stores.approval_status,
					product_count: stores.product_count,
					featured: stores.featured,
					created_at: stores.created_at,
					updated_at: stores.updated_at,
					owner: {
						id: users.id,
						name: users.name,
						avatar_url: users.avatar_url,
					},
					province: { name: provinces.name, code: provinces.code },
					isSave: isSaveColumn(currentUserId),
					isOwner: isOwnerColumn(currentUserId),
					isFollowed: isFollowColumn(currentUserId),
					...reviewStatsColumns(),
				})
				.from(stores)
				.leftJoin(users, eq(users.id, stores.owner_id))
				.leftJoin(provinces, eq(provinces.id, stores.province_id))
				.where(and(...conditions))
				.orderBy(...orderBy)
				.limit(limit + 1)
				.offset(offset)

			const hasMore = rows.length > limit
			const storeList = hasMore ? rows.slice(0, limit) : rows
			const nextCursor = hasMore
				? { created_at: new Date().toISOString(), id: offset + limit }
				: null
			return { stores: storeList, nextCursor, hasMore }
		}

		if (filters?.cursor) {
			conditions.push(buildCursorFilter(stores, filters.cursor) as SQL)
		}

		const whereCondition = and(...conditions)

		const results = await db.query.stores.findMany({
			where: whereCondition,
			with: {
				owner: {
					columns: { id: true, name: true, avatar_url: true },
				},
				province: {
					columns: { name: true, code: true },
				},
			},
			extras: {
				isSave: isSaveColumn(currentUserId).as('isSave'),
				isOwner: isOwnerColumn(currentUserId).as('isOwner'),
				isFollowed: isFollowColumn(currentUserId).as('isFollowed'),
				review_count: reviewStatsColumns().review_count.as('review_count'),
				average_rating:
					reviewStatsColumns().average_rating.as('average_rating'),
			},
			orderBy: [desc(stores.created_at), desc(stores.id)],
			limit: limit + 1,
		})

		const {
			list: storeList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { stores: storeList, nextCursor, hasMore }
	},

	async getById(id: number) {
		const whereCondition = and(eq(stores.id, id), eq(stores.is_active, true))

		const store = await db.query.stores.findFirst({
			where: whereCondition,
			with: {
				owner: {
					columns: { id: true, name: true, avatar_url: true },
				},
				province: {
					columns: { name: true, code: true },
				},
			},
		})
		if (!store) return store

		const [followerCountRows, reviewStatsRows] = await Promise.all([
			db
				.select({ count: sql<number>`count(*)` })
				.from(storeFollows)
				.where(eq(storeFollows.store_id, id)),
			db
				.select({
					review_count: sql<number>`count(*)::int`,
					average_rating: sql<number>`COALESCE(ROUND(AVG(rating)::numeric, 2), 0)`,
				})
				.from(storeReviews)
				.where(eq(storeReviews.store_id, id)),
		])

		return {
			...store,
			follower_count: Number(followerCountRows[0]?.count ?? 0),
			review_count: reviewStatsRows[0]?.review_count ?? 0,
			average_rating: Number(reviewStatsRows[0]?.average_rating ?? 0),
		}
	},

	async getByOwnerId(userId: string) {
		const whereCondition = and(
			eq(stores.is_active, true),
			eq(stores.owner_id, userId),
		)

		const results = await db.query.stores.findMany({
			where: whereCondition,
			with: {
				owner: {
					columns: { id: true, name: true, avatar_url: true },
				},
				province: {
					columns: { name: true, code: true },
				},
			},
			extras: { isSave: isSaveColumn(userId).as('isSave') },
			orderBy: [desc(stores.created_at), desc(stores.id)],
		})

		// Every row here is already filtered to `userId`'s own stores — no
		// per-row SQL needed, `isOwner` is trivially true for all of them.
		// `isSave` still needs the real check — favoriting your own store is
		// an edge case, but a real one.
		return results.map((store) => ({ ...store, isOwner: true }))
	},

	// Returns the fully hydrated row (same shape as getById) instead of a
	// bare id — the frontend writes this straight into its caches (the
	// owner's "mine" list + the detail cache) instead of refetching.
	async create(data: CreateStore & { owner_id: string }) {
		// A store's ltree `path` mirrors the category it belongs to.
		const category = await db.query.categories.findFirst({
			where: eq(categories.id, data.category_id),
			columns: { path: true },
		})
		if (!category) throw ApiError.notFound('Category not found')

		await Promise.all([
			storage.validateNewImage(data.logo_url),
			storage.validateNewImage(data.banner_url),
		])

		const [created] = await db
			.insert(stores)
			.values({ ...data, path: category.path })
			.returning({ id: stores.id })

		return created ? this.getById(created.id) : undefined
	},

	// Same reasoning as create.
	async update(id: number, data: UpdateStore) {
		const previous =
			data.logo_url !== undefined || data.banner_url !== undefined
				? await db.query.stores.findFirst({
						where: eq(stores.id, id),
						columns: { logo_url: true, banner_url: true },
					})
				: undefined

		await Promise.all([
			storage.validateNewImage(data.logo_url, previous?.logo_url),
			storage.validateNewImage(data.banner_url, previous?.banner_url),
		])

		const [updated] = await db
			.update(stores)
			.set(data)
			.where(eq(stores.id, id))
			.returning({ id: stores.id })
		if (!updated) return null

		await Promise.all([
			storage.reconcileImage(previous?.logo_url, data.logo_url),
			storage.reconcileImage(previous?.banner_url, data.banner_url),
		])
		return this.getById(updated.id)
	},

	// Deleting the row cascades (at the DB level — `products.store_id` and
	// `store_reviews.store_id` are both `onDelete: cascade`, and products'
	// own cascade takes their reviews with them too) straight through every
	// product and review this store has, two levels deep. None of that ever
	// runs application code, so this is the only place any of those images
	// get reconciled — collect every url *before* the delete fires, since
	// the rows (and the only record of which urls they held) are gone the
	// instant it does.
	async delete(id: number) {
		const [store, ownReviews, storeProducts] = await Promise.all([
			db.query.stores.findFirst({
				where: eq(stores.id, id),
				columns: { logo_url: true, banner_url: true },
			}),
			db.query.storeReviews.findMany({
				where: eq(storeReviews.store_id, id),
				columns: { images: true },
			}),
			db.query.products.findMany({
				where: eq(products.store_id, id),
				columns: { id: true, images: true },
			}),
		])

		const productIds = storeProducts.map((p) => p.id)
		const productReviewRows = productIds.length
			? await db.query.productReviews.findMany({
					where: inArray(productReviews.product_id, productIds),
					columns: { images: true },
				})
			: []

		await db.delete(stores).where(eq(stores.id, id))

		if (store) {
			await Promise.all([
				storage.reconcileImage(store.logo_url, null),
				storage.reconcileImage(store.banner_url, null),
				storage.reconcileImages(
					ownReviews.flatMap((r) => r.images as string[]),
					[],
				),
				storage.reconcileImages(
					productReviewRows.flatMap((r) => r.images as string[]),
					[],
				),
				storage.reconcileImages(
					storeProducts.flatMap((p) =>
						(p.images as ProductImage[]).map((i) => i.url),
					),
					[],
				),
			])
		}
		return 'Store deleted successfully'
	},

	// ==================== FOLLOW ====================

	// Mirrors `favoriteStoreService.isFavorited` — used by `getById`'s
	// controller the same way that one feeds `isSave`, since a single-row
	// fetch there goes through `db.query.stores.findFirst` without the
	// `currentUserId`-aware SQL columns above.
	async isFollowing(userId: string, storeId: number): Promise<boolean> {
		const existing = await db.query.storeFollows.findFirst({
			where: and(
				eq(storeFollows.user_id, userId),
				eq(storeFollows.store_id, storeId),
			),
			columns: { id: true },
		})
		return !!existing
	},

	async toggleFollow(userId: string, storeId: number, followerName: string) {
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, storeId),
			columns: { id: true, owner_id: true, name: true },
		})
		if (!store) throw ApiError.notFound('Store not found')

		const existing = await db.query.storeFollows.findFirst({
			where: and(
				eq(storeFollows.user_id, userId),
				eq(storeFollows.store_id, storeId),
			),
		})

		if (existing) {
			// Already following → unfollow
			await db
				.delete(storeFollows)
				.where(
					and(
						eq(storeFollows.user_id, userId),
						eq(storeFollows.store_id, storeId),
					),
				)
			return { store_id: storeId, followed: false }
		}

		// Not yet following → follow (.onConflictDoNothing handles concurrent requests)
		await db
			.insert(storeFollows)
			.values({ user_id: userId, store_id: storeId })
			.onConflictDoNothing()

		// Notify the store owner in the background — don't block the response.
		// Always pushes (see notificationDispatchService's new_follower special
		// case), not gated by a preference column.
		if (store.owner_id !== userId) {
			notificationDispatchService
				.notifyUsers({
					type: 'new_follower',
					recipients: [store.owner_id],
					actorId: userId,
					data: {
						title: 'New Follower',
						body: `${followerName} started following your store "${store.name}"`,
						store_name: store.name,
						actor_name: followerName,
					},
					push: {
						title: 'New Follower',
						body: `${followerName} started following your store "${store.name}"`,
					},
				})
				.catch((err) =>
					console.error('[notification] failed to notify store owner:', err),
				)
		}

		return { store_id: storeId, followed: true }
	},

	// All follower ids of a store, unpaginated — used for notification fanout
	// (e.g. "new product from a store you follow"), not for any UI list
	// (which uses the paginated getStoreFollowers below).
	async getAllFollowerIds(storeId: number): Promise<string[]> {
		const rows = await db
			.select({ user_id: storeFollows.user_id })
			.from(storeFollows)
			.where(eq(storeFollows.store_id, storeId))
		return rows.map((r) => r.user_id)
	},

	// All store ids a user follows — cards/menus check membership against this.
	async getFollowingIds(userId: string): Promise<number[]> {
		const rows = await db
			.select({ store_id: storeFollows.store_id })
			.from(storeFollows)
			.where(eq(storeFollows.user_id, userId))
		return rows.map((r) => r.store_id)
	},

	// ── Stores a user follows (paginated) ───────────────────────────────────
	async getFollowedStores(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(storeFollows.user_id, userId)
		const whereCondition = cursor
			? and(
					baseFilter,
					buildCursorFilter(
						{ created_at: storeFollows.followed_at, id: storeFollows.store_id },
						cursor,
						Number,
					),
				)
			: baseFilter

		const rows = await db.query.storeFollows.findMany({
			where: whereCondition,
			with: {
				store: {
					columns: {
						id: true,
						name: true,
						logo_url: true,
						owner_id: true,
						product_count: true,
					},
				},
			},
			orderBy: [desc(storeFollows.followed_at), desc(storeFollows.store_id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.followed_at, id: r.store_id })),
			limit,
		)
		// One extra query for the whole page instead of a per-row subquery —
		// `isOwner` only needed `owner_id`, already fetched above, but `isSave`
		// has no column to compare against here, so membership-check it the
		// same way `favoriteStoreService.getFavorites` does.
		const favoriteIds = new Set(await favoriteStoreService.getIds(userId))
		return {
			stores: list
				.filter((r) => r.store)
				.map((r) => {
					const { owner_id, ...store } = r.store!
					return {
						...store,
						isOwner: owner_id === userId,
						isSave: favoriteIds.has(store.id),
						// Every row here is already filtered to `userId`'s own
						// follows (`whereCondition` above) — trivially true for
						// all of them, same reasoning as `isSave: true` in
						// `favoriteStoreService.getFavorites`.
						isFollowed: true,
					}
				}),
			nextCursor,
			hasMore,
		}
	},

	// ── Followers of a store (paginated) ──────────────────────────────────
	async getStoreFollowers(storeId: number, limit: number, cursor?: CursorData) {
		const baseFilter = eq(storeFollows.store_id, storeId)
		const whereCondition = cursor
			? and(
					baseFilter,
					buildCursorFilter(
						{ created_at: storeFollows.followed_at, id: storeFollows.user_id },
						cursor,
						String,
					),
				)
			: baseFilter

		const rows = await db.query.storeFollows.findMany({
			where: whereCondition,
			with: { user: { columns: { id: true, name: true, avatar_url: true } } },
			orderBy: [desc(storeFollows.followed_at), desc(storeFollows.user_id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.followed_at, id: r.user_id })),
			limit,
		)
		return { followers: list.map((r) => r.user), nextCursor, hasMore }
	},
}
