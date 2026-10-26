import type { Context } from 'hono'
import { favoriteStoreService } from '../services/favoriteStoreService.ts'
import { ordersService } from '../services/ordersService.ts'
import { storeService } from '../services/storeService.ts'
import { storeViewService } from '../services/storeViewService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { StoreSort } from '../utils/types.ts'

const LTREE_LABEL = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/
const SORT_VALUES: StoreSort[] = [
	'relevance',
	'rating_desc',
	'followers_desc',
	'products_desc',
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

async function assertStoreOwner(
	id: number,
	currentUser: { id: string; role?: string },
) {
	const store = await storeService.getById(id)
	if (!store) throw ApiError.notFound('Store not found')
	if (store.owner_id !== currentUser.id && currentUser.role !== 'admin') {
		throw ApiError.forbidden()
	}
	return store
}

export const storeController = {
	async getSuggestions(c: Context) {
		const search = c.req.query('q') as string
		if (!search) return c.json({ success: true, data: [] })

		const results = await storeService.getSuggestions(search)
		return c.json({ success: true, data: results })
	},
	async getAll(c: Context) {
		const user = c.get('user')
		const query = c.req.query()
		const cursor = query.cursor
		const parsedCursor = parseCursor(cursor)
		const limit = 12

		const categoryPaths = query.category_paths
			?.split(',')
			.map((p) => p.trim())
			.filter((p) => LTREE_LABEL.test(p))
		const provinceIds = parseIdList(query.province_ids)
		const sort = SORT_VALUES.includes(query.sort as StoreSort)
			? (query.sort as StoreSort)
			: undefined

		const filters = {
			search: query.search || undefined,
			category_id: query.category_id ? Number(query.category_id) : undefined,
			category_paths: categoryPaths?.length ? categoryPaths : undefined,
			province_id: query.province_id ? Number(query.province_id) : undefined,
			province_ids: provinceIds,
			min_rating: query.min_rating || undefined,
			verified_only: query.verified_only === 'true' ? true : undefined,
			sort,
			limit,
			cursor: parsedCursor,
		}

		const result = await storeService.getAll(filters, user?.id)
		return c.json({ success: true, data: result })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const store = await storeService.getById(id)
		if (!store) throw ApiError.notFound('Store not found')

		const user = c.get('user')
		if (user) {
			storeViewService
				.recordView(user.id, id)
				.catch((err) =>
					console.error('[store-view] failed to record view:', err),
				)
		}

		const isOwner = user ? store.owner_id === user.id : false
		const [isSave, isFollowed] = user
			? await Promise.all([
					favoriteStoreService.isFavorited(user.id, id),
					storeService.isFollowing(user.id, id),
				])
			: [false, false]
		return c.json({
			success: true,
			data: { ...store, isOwner, isSave, isFollowed },
		})
	},

	async getByOwner(c: Context) {
		const userId = c.req.param('userId') as string
		const viewer = c.get('user')
		const stores = await storeService.getByOwnerId(userId, viewer?.id)
		return c.json({ success: true, data: stores })
	},

	async create(c: Context) {
		const data = c.get('validated')
		const currentUser = c.get('user')
		const store = await storeService.create({
			...data,
			owner_id: currentUser.id,
		})
		if (!store) throw ApiError.notFound('Store not found')
		// Brand new — nobody could have favorited/followed it before it
		// existed, and the creator always owns it, so none of these need a
		// query.
		return c.json(
			{
				success: true,
				data: { ...store, isOwner: true, isSave: false, isFollowed: false },
			},
			201,
		)
	},

	async update(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertStoreOwner(id, currentUser)

		const data = c.get('validated')
		const updated = await storeService.update(id, data)
		if (!updated) throw ApiError.notFound('Store not found')
		const [isSave, isFollowed] = await Promise.all([
			favoriteStoreService.isFavorited(currentUser.id, id),
			storeService.isFollowing(currentUser.id, id),
		])
		return c.json({
			success: true,
			data: { ...updated, isOwner: true, isSave, isFollowed },
		})
	},

	// Owner-only: store identity + all-time order aggregates in one request.
	async getDashboard(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		const store = await assertStoreOwner(id, currentUser)

		const stats = await ordersService.getStoreDashboard(id)
		return c.json({ success: true, data: { store, ...stats } })
	},

	async delete(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string; role?: string }
		await assertStoreOwner(id, currentUser)

		await storeService.delete(id)
		return c.json({ success: true, message: 'Store deleted successfully' })
	},

	// ==================== FOLLOW ====================

	async toggleFollow(c: Context) {
		const currentUser = c.get('user')
		const storeId = parseId(c, 'storeId')
		const result = await storeService.toggleFollow(
			currentUser.id,
			storeId,
			currentUser.name,
		)
		if (!result) throw ApiError.notFound('Store not found')
		return c.json({ success: true, data: result })
	},

	async getStoreFollowers(c: Context) {
		const storeId = parseId(c, 'storeId')
		const cursor = parseCursor(c.req.query('cursor'))
		const limit = 12
		const result = await storeService.getStoreFollowers(
			storeId,
			limit,
			cursor ?? undefined,
		)
		return c.json({ success: true, data: result })
	},

	async getFollowingIds(c: Context) {
		const currentUser = c.get('user')
		const ids = await storeService.getFollowingIds(currentUser.id)
		return c.json({ success: true, data: ids })
	},

	async getFollowedStores(c: Context) {
		const currentUser = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))
		const result = await storeService.getFollowedStores(
			currentUser.id,
			limit,
			cursor ?? undefined,
		)
		return c.json({ success: true, data: result })
	},
}
