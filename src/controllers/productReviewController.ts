import type { Context } from 'hono'
import { productReviewService } from '../services/productReviewService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { ReviewSort } from '../utils/types.ts'

const SORT_VALUES: ReviewSort[] = ['newest', 'helpful']

export const productReviewController = {
	async getAll(c: Context) {
		const productId = parseId(c, 'productId')
		const limit = 12
		const query = c.req.query()
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

		const result = await productReviewService.getAll(
			productId,
			limit,
			parsedCursor,
			currentUser?.id,
			filters,
		)
		return c.json({ success: true, data: result })
	},

	async getSummary(c: Context) {
		const productId = parseId(c, 'productId')
		const summary = await productReviewService.getSummary(productId)
		return c.json({ success: true, data: summary })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user') as { id: string } | undefined
		const review = await productReviewService.getById(id, currentUser?.id)
		if (!review) throw ApiError.notFound('Review not found')
		return c.json({ success: true, data: review })
	},

	async create(c: Context) {
		const currentUser = c.get('user')
		const data = c.get('validated')
		const result = await productReviewService.create(
			currentUser.id,
			data,
			currentUser.name,
		)
		return c.json({ success: true, data: result }, 201)
	},

	async update(c: Context) {
		const currentUser = c.get('user')
		const id = parseId(c)
		const data = c.get('validated')
		const result = await productReviewService.update(
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
		const result = await productReviewService.delete(
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
		const result = await productReviewService.reply(
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
		const result = await productReviewService.react(
			id,
			currentUser.id,
			reaction,
		)
		return c.json({ success: true, data: result })
	},
}
