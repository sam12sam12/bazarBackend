import type { Context } from 'hono'
import { provinceService } from '../services/provinceService.ts'

export const provinceController = {
	async getAll(c: Context) {
		const results = await provinceService.getAll()
		return c.json({ success: true, data: results })
	},
}
