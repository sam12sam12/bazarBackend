import type { Context } from 'hono'
import { categoryService } from '../services/categoryService.ts'

export const categoryController = {
	async getTree(c: Context) {
		const tree = await categoryService.getTree()
		return c.json({ success: true, data: tree })
	},
}
