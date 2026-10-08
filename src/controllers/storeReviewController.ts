import type { Context } from 'hono'
import { storeReviewService } from '../services/storeReviewService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { ReviewSort } from '../utils/types.ts'

const SORT_VALUES: ReviewSort[] = ['newest', 'helpful']

export const storeReviewController = {
	async getAll(c: Context) {
		const storeId = parseId(c, 'storeId')
		const query = c.req.query()
		const limit = Number(query.limit) || 12
		const parsedCursor = parseCursor(query.cursor)
		const currentUser = c.get('user') as { id: string } | undefined

		const rating = Number(query.rating)
		const filters = {
			rating:
				Number.isInteger(rating) && rating >= 1 && rating <= 5
					? rating
					: undefined,
			sort: SORT_VALUES.includes(query.sort as ReviewSort)
				? (query.sort as ReviewSort)
				: undefined,
		}

		const result = await storeReviewService.getAll(
			storeId,
			limit,
			parsedCursor,
			currentUser?.id,
			filters,
		)
		return c.json({ success: true, data: result })
	},

	async getSummary(c: Context) {
		const storeId = parseId(c, 'storeId')
		const summary = await storeReviewService.getSummary(storeId)
		return c.json({ success: true, data: summary })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string } | undefined
		const review = await storeReviewService.getById(id, currentUser?.id)
		if (!review) throw ApiError.notFound('Review not found')
		return c.json({ success: true, data: review })
	},

	async create(c: Context) {
		const currentUser = c.get('user')
		const data = c.get('validated')
		const result = await storeReviewService.create(currentUser.id, data)
		return c.json({ success: true, data: result }, 201)
	},

	async update(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const data = c.get('validated')
		const result = await storeReviewService.update(
			id,
			currentUser.id,
			currentUser.role === 'admin',
			data,
		)
		return c.json({ success: true, data: result })
	},

	async delete(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const result = await storeReviewService.delete(
			id,
			currentUser.id,
			currentUser.role === 'admin',
		)
		return c.json({ success: true, message: result })
	},

	async reply(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const { owner_reply } = c.get('validated')
		const result = await storeReviewService.reply(
			id,
			currentUser.id,
			currentUser.role === 'admin',
			owner_reply,
		)
		return c.json({ success: true, data: result })
	},

	async react(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const { reaction } = c.get('validated')
		const result = await storeReviewService.react(id, currentUser.id, reaction)
		return c.json({ success: true, data: result })
	},
}
