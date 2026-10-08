import type { Context } from 'hono'
import { favoriteStoreService } from '../services/favoriteStoreService.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'

export const favoriteStoreController = {
	async toggle(c: Context) {
		const currentUser = c.get('user')
		const storeId = parseId(c)
		const result = await favoriteStoreService.toggle(currentUser.id, storeId)
		return c.json({ success: true, data: result })
	},

	async getIds(c: Context) {
		const currentUser = c.get('user')
		const ids = await favoriteStoreService.getIds(currentUser.id)
		return c.json({ success: true, data: ids })
	},

	async getMine(c: Context) {
		const currentUser = c.get('user')
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))
		const result = await favoriteStoreService.getFavorites(
			currentUser.id,
			limit,
			cursor,
		)
		return c.json({ success: true, data: result })
	},
}
