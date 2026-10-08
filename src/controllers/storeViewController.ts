import type { Context } from 'hono'
import { storeViewService } from '../services/storeViewService.ts'

export const storeViewController = {
	async getRecent(c: Context) {
		const user = c.get('user')
		const stores = await storeViewService.getRecent(user.id, 5)
		return c.json({ success: true, data: { stores } })
	},
}
