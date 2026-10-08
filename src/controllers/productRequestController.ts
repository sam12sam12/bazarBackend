import type { Context } from 'hono'
import { favoriteRequestService } from '../services/favoriteRequestService'
import { productRequestService } from '../services/productRequestService'
import { parseCursor, parseId } from '../utils/pagination'
import type { PublicRequestSort } from '../utils/types'

const LIMIT = 12
const SORT_VALUES: PublicRequestSort[] = ['newest', 'budget_asc', 'budget_desc']

// "1,2,3" -> [1, 2, 3]; drops non-positive/NaN entries; undefined for empty/missing.
function parseIdList(raw: string | undefined): number[] | undefined {
	if (!raw) return undefined
	const ids = raw
		.split(',')
		.map((part) => Number(part.trim()))
		.filter((id) => Number.isFinite(id) && id > 0)
	return ids.length > 0 ? ids : undefined
}

export const productRequestController = {
	async create(c: Context) {
		const currentUser = c.get('user')
		const data = c.get('validated')
		const request = await productRequestService.create(currentUser.id, data)
		return c.json({ success: true, data: request }, 201)
	},

	async getPublic(c: Context) {
		const user = c.get('user')
		const parsedCursor = parseCursor(c.req.query('cursor'))

		// `categoryId` (singular) stays for SimilarRequests' single-category
		// lookup; the filter chips send `categoryIds` (comma-separated).
		const categoryQuery = c.req.query('categoryId')
		const categoryId = categoryQuery ? Number(categoryQuery) : undefined
		const categoryIds =
			parseIdList(c.req.query('categoryIds')) ??
			(categoryId && categoryId > 0 ? [categoryId] : undefined)

		const provinceIds = parseIdList(c.req.query('provinceIds'))
		const minBudget = c.req.query('minBudget')
		const maxBudget = c.req.query('maxBudget')
		const search = c.req.query('search')
		const sortQuery = c.req.query('sortBy')
		const sortBy = SORT_VALUES.includes(sortQuery as PublicRequestSort)
			? (sortQuery as PublicRequestSort)
			: undefined

		const { requests, nextCursor } = await productRequestService.getPublic(
			LIMIT,
			parsedCursor,
			{ categoryIds, provinceIds, minBudget, maxBudget, search, sortBy },
			user?.id,
		)
		return c.json({ success: true, data: { requests, nextCursor } })
	},

	async getMyRequests(c: Context) {
		const currentUser = c.get('user')
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const { requests, nextCursor } =
			await productRequestService.getUserRequests(
				currentUser.id,
				LIMIT,
				parsedCursor,
			)
		return c.json({ success: true, data: { requests, nextCursor } })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const request = await productRequestService.getById(id)

		const user = c.get('user')
		const isOwner = user ? request.user_id === user.id : false
		const isSave = user
			? await favoriteRequestService.isFavorited(user.id, id)
			: false
		return c.json({ success: true, data: { ...request, isOwner, isSave } })
	},

	async update(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const data = c.get('validated')
		const request = await productRequestService.update(
			id,
			currentUser.id,
			currentUser.role === 'admin',
			data,
		)
		return c.json({ success: true, data: request })
	},

	async setStatus(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const { status } = c.get('validated')
		const request = await productRequestService.setStatus(
			id,
			currentUser.id,
			currentUser.role === 'admin',
			status,
		)
		return c.json({ success: true, data: request })
	},

	async remove(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const message = await productRequestService.remove(
			id,
			currentUser.id,
			currentUser.role === 'admin',
		)
		return c.json({ success: true, data: message })
	},
}
