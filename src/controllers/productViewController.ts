import type { Context } from 'hono'
import { productViewService } from '../services/productViewService.ts'

export const productViewController = {
	async getRecent(c: Context) {
		const user = c.get('user')
		const products = await productViewService.getRecent(user.id, 5)
		return c.json({ success: true, data: { products } })
	},
}
