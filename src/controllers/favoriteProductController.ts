import type { Context } from 'hono'
import { favoriteProductService } from '../services/favoriteProductService.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'

export const favoriteProductController = {
	async toggle(c: Context) {
		const currentUser = c.get('user')
		const productId = parseId(c)
		const result = await favoriteProductService.toggle(
			currentUser.id,
			productId,
		)
		return c.json({ success: true, data: result })
	},

	async getIds(c: Context) {
		const currentUser = c.get('user')
		const ids = await favoriteProductService.getIds(currentUser.id)
		return c.json({ success: true, data: ids })
	},

	async getMine(c: Context) {
		const currentUser = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))
		const result = await favoriteProductService.getFavorites(
			currentUser.id,
			limit,
			cursor,
		)
		return c.json({ success: true, data: result })
	},
}
