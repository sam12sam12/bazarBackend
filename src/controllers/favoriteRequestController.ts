import type { Context } from 'hono'
import { favoriteRequestService } from '../services/favoriteRequestService.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'

export const favoriteRequestController = {
	async toggle(c: Context) {
		const currentUser = c.get('user')
		const requestId = parseId(c)
		const result = await favoriteRequestService.toggle(
			currentUser.id,
			requestId,
		)
		return c.json({ success: true, data: result })
	},

	async getIds(c: Context) {
		const currentUser = c.get('user')
		const ids = await favoriteRequestService.getIds(currentUser.id)
		return c.json({ success: true, data: ids })
	},

	async getMine(c: Context) {
		const currentUser = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))
		const result = await favoriteRequestService.getFavorites(
			currentUser.id,
			limit,
			cursor,
		)
		return c.json({ success: true, data: result })
	},
}
