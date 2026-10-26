import {
	and,
	arrayOverlaps,
	asc,
	desc,
	eq,
	gte,
	inArray,
	lte,
	sql,
} from 'drizzle-orm'
import { db } from '../db/db'
import { productRequests } from '../db/schema'
import type {
	InsertProductRequest,
	UpdateProductRequest,
} from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { buildFuzzySearch } from '../utils/search'
import { storage } from '../utils/storage/instance'
import type { PublicRequestFilters } from '../utils/types'

// The combined tsvector-source (title+description) and the single
// similarity column (title only) — same hybrid-search shape
// `productFuzzySearchTarget` builds for products, just this entity's own
// columns.
function requestFuzzySearchTarget() {
	return {
		textColumns: [
			sql`coalesce(${productRequests.title}, '')`,
			sql`coalesce(${productRequests.description}, '')`,
		],
		similarityColumn: sql`${productRequests.title}`,
	}
}

interface RequestImage {
	url: string
	sort_order: number
	is_primary: boolean
}

type RequestStatus = 'open' | 'resolved' | 'closed'

// Relations returned to clients when listing/reading a request.
export const requestWith = {
	user: { columns: { id: true, name: true, avatar_url: true } },
	category: { columns: { id: true, name: true } },
	province: { columns: { id: true, name: true } },
} as const

// Whether `currentUserId` has favorited this row — `false` with no SQL cost
// when there's no signed-in caller. Mirrors `isOwner`'s controller-level
// pattern but as a SQL column, for use with a relational query's `extras`.
//
// The outer row id is deliberately written as literal SQL (not interpolated
// via the column object) — drizzle renders an interpolated column as a
// bare, unqualified identifier here, and since `favorite_requests` has its
// own `id` column too, an unqualified `id` inside this subquery would
// resolve to *that* one instead of correlating to the outer row, silently
// matching nothing. It's quoted as `"productRequests".id` (not
// `product_requests.id`) because a relational `findMany` query aliases its
// FROM table to the camelCase schema key, not the snake_case table name —
// and unquoted in SQL, `productRequests` would itself lowercase to
// `productrequests` and fail to resolve.
function isSaveColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`EXISTS (SELECT 1 FROM favorite_requests WHERE favorite_requests.user_id = ${currentUserId} AND favorite_requests.request_id = "productRequests".id)`
		: sql<boolean>`false`
}

// Whether `currentUserId` posted this row — same SQL-extras pattern as
// `isSaveColumn` above, so list endpoints never make a caller compare
// `request.user.id` to the current user client-side (getById's controller
// already does this comparison server-side too, for the single-row case).
function isOwnerColumn(currentUserId?: string) {
	return currentUserId
		? sql<boolean>`${productRequests.user_id} = ${currentUserId}`
		: sql<boolean>`false`
}

export const productRequestService = {
	// ── Search Suggestions (Minimal data) ── mirrors productService's own,
	// same shape so Bazar56's SearchSuggestions component can render either.
	async getSuggestions(search: string, limit: number = 10) {
		if (search.length < 1) return []
		const { condition, rank } = buildFuzzySearch(
			search,
			requestFuzzySearchTarget(),
		)
		const whereCondition = and(eq(productRequests.status, 'open'), condition)
		const results = await db
			.select({
				id: productRequests.id,
				title: productRequests.title,
				image: sql<string>`images->0->>'url'`,
			})
			.from(productRequests)
			.where(whereCondition)
			.orderBy(desc(rank))
			.limit(limit)

		return results
	},

	// Returns the fully hydrated row (same shape as getById, joined with
	// category/province) instead of the raw insert row — the frontend
	// writes this straight into its caches instead of refetching.
	async create(userId: string, data: InsertProductRequest) {
		await storage.validateNewImages(
			((data.images as RequestImage[] | undefined) ?? []).map((i) => i.url),
		)

		const [request] = await db
			.insert(productRequests)
			.values({ ...data, user_id: userId })
			.returning({ id: productRequests.id })
		return request ? this.getById(request.id) : undefined
	},

	// Public browse — only open requests, optionally filtered/sorted.
	async getPublic(
		limit: number,
		cursor?: CursorData,
		filters?: PublicRequestFilters,
		currentUserId?: string,
	) {
		const statusFilter = eq(productRequests.status, 'open')
		const categoryFilter = filters?.categoryIds?.length
			? inArray(productRequests.category_id, filters.categoryIds)
			: undefined
		const provinceFilter = filters?.provinceIds?.length
			? inArray(productRequests.province_id, filters.provinceIds)
			: undefined
		// `condition` is an array column now (a request can accept more than
		// one) — "matches the filter" means the two arrays share at least one
		// value, not that the column equals one of the filter's values.
		const conditionFilter = filters?.conditions?.length
			? arrayOverlaps(productRequests.condition, filters.conditions)
			: undefined
		// Both bounds compare against the request's own ceiling (budget_max) —
		// the amount the buyer is actually willing to pay, and the figure a
		// seller browsing requests cares about. Comparing minBudget against
		// budget_min instead would compare it against the buyer's floor, which
		// sits far lower for nearly every request and made the min filter
		// return almost nothing.
		const minBudgetFilter = filters?.minBudget
			? gte(productRequests.budget_max, filters.minBudget)
			: undefined
		const maxBudgetFilter = filters?.maxBudget
			? lte(productRequests.budget_max, filters.maxBudget)
			: undefined
		const searchFilter =
			filters?.search && filters.search.length >= 1
				? buildFuzzySearch(filters.search, requestFuzzySearchTarget()).condition
				: undefined

		const sortBy = filters?.sortBy ?? 'newest'

		// Budget sort can't reuse the shared (created_at, id) cursor — its
		// order has nothing to do with those columns — so it pages by plain
		// offset instead, carried in cursor.id; cursor.created_at just rides
		// along unused to satisfy the shared CursorData shape.
		if (sortBy !== 'newest') {
			const offset = cursor ? Number(cursor.id) : 0
			const whereCondition = and(
				statusFilter,
				categoryFilter,
				provinceFilter,
				conditionFilter,
				minBudgetFilter,
				maxBudgetFilter,
				searchFilter,
			)
			const orderBy =
				sortBy === 'budget_asc'
					? [asc(productRequests.budget_max), desc(productRequests.id)]
					: [desc(productRequests.budget_max), desc(productRequests.id)]

			const results = await db.query.productRequests.findMany({
				where: whereCondition,
				with: requestWith,
				extras: {
					isSave: isSaveColumn(currentUserId).as('isSave'),
					isOwner: isOwnerColumn(currentUserId).as('isOwner'),
				},
				orderBy,
				limit: limit + 1,
				offset,
			})

			const hasMore = results.length > limit
			const list = hasMore ? results.slice(0, limit) : results
			const nextCursor = hasMore
				? { created_at: new Date().toISOString(), id: offset + limit }
				: null
			return { requests: list, nextCursor }
		}

		const cursorFilter = cursor
			? buildCursorFilter(productRequests, cursor)
			: undefined
		const whereCondition = and(
			statusFilter,
			categoryFilter,
			provinceFilter,
			conditionFilter,
			minBudgetFilter,
			maxBudgetFilter,
			searchFilter,
			cursorFilter,
		)

		const results = await db.query.productRequests.findMany({
			where: whereCondition,
			with: requestWith,
			extras: {
				isSave: isSaveColumn(currentUserId).as('isSave'),
				isOwner: isOwnerColumn(currentUserId).as('isOwner'),
			},
			orderBy: [desc(productRequests.created_at), desc(productRequests.id)],
			limit: limit + 1,
		})

		const { list, nextCursor } = paginateResults(results, limit)
		return { requests: list, nextCursor }
	},

	async getUserRequests(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(productRequests.user_id, userId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(productRequests, cursor))
			: baseFilter

		const results = await db.query.productRequests.findMany({
			where: whereCondition,
			with: requestWith,
			extras: { isSave: isSaveColumn(userId).as('isSave') },
			orderBy: [desc(productRequests.created_at), desc(productRequests.id)],
			limit: limit + 1,
		})

		const { list, nextCursor } = paginateResults(results, limit)
		// Every row here is already filtered to `userId`'s own requests — no
		// per-row SQL needed, `isOwner` is trivially true for all of them.
		// `isSave` still needs the real check — favoriting your own request
		// is an edge case, but a real one.
		return {
			requests: list.map((request) => ({ ...request, isOwner: true })),
			nextCursor,
		}
	},

	async getById(id: number) {
		const request = await db.query.productRequests.findFirst({
			where: eq(productRequests.id, id),
			with: requestWith,
		})
		if (!request) throw ApiError.notFound('Product request not found')
		return request
	},

	// Same reasoning as create.
	async update(
		id: number,
		userId: string,
		isAdmin: boolean,
		data: UpdateProductRequest,
	) {
		await assertOwnerOrAdmin(id, userId, isAdmin)

		const previous = data.images
			? await db.query.productRequests.findFirst({
					where: eq(productRequests.id, id),
					columns: { images: true },
				})
			: undefined
		const previousUrls = (previous?.images as RequestImage[] | undefined)?.map(
			(i) => i.url,
		)

		if (data.images) {
			await storage.validateNewImages(
				(data.images as RequestImage[]).map((i) => i.url),
				previousUrls ?? [],
			)
		}

		const [updated] = await db
			.update(productRequests)
			.set(data)
			.where(eq(productRequests.id, id))
			.returning({ id: productRequests.id })
		if (!updated) return null

		if (data.images) {
			await storage.reconcileImages(
				previousUrls,
				(data.images as RequestImage[]).map((i) => i.url),
			)
		}
		return this.getById(updated.id)
	},

	async setStatus(
		id: number,
		userId: string,
		isAdmin: boolean,
		status: RequestStatus,
	) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		const [updated] = await db
			.update(productRequests)
			.set({ status })
			.where(eq(productRequests.id, id))
			.returning()
		return updated
	},

	async remove(id: number, userId: string, isAdmin: boolean) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		const request = await db.query.productRequests.findFirst({
			where: eq(productRequests.id, id),
			columns: { images: true },
		})
		await db.delete(productRequests).where(eq(productRequests.id, id))
		if (request) {
			await storage.reconcileImages(
				(request.images as RequestImage[]).map((i) => i.url),
				[],
			)
		}
		return 'Product request deleted'
	},
}

// Fetches the request and ensures the caller owns it (or is an admin).
async function assertOwnerOrAdmin(
	id: number,
	userId: string,
	isAdmin: boolean,
) {
	const request = await db.query.productRequests.findFirst({
		where: eq(productRequests.id, id),
		columns: { id: true, user_id: true },
	})
	if (!request) throw ApiError.notFound('Product request not found')
	if (!isAdmin && request.user_id !== userId) throw ApiError.forbidden()
	return request
}
