import type { Context } from 'hono'
import { bannerService } from '../services/bannerService'
import { ApiError } from '../utils/ApiError'
import { parseCursor, parseId } from '../utils/pagination.ts'

export const bannerController = {
	async getAll(c: Context) {
		const limit = 12
		const cursor = c.req.query('cursor')
		const parsedCursor = parseCursor(cursor)

		const { banners, nextCursor } = await bannerService.getAll(
			limit,
			parsedCursor,
		)
		return c.json({ success: true, data: banners, nextCursor })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const banner = await bannerService.getById(id)
		if (!banner) throw ApiError.notFound('Banner not found')
		return c.json({ success: true, data: banner })
	},

	async create(c: Context) {
		const body = c.get('validated')
		const banner = await bannerService.create(body)
		return c.json({ success: true, data: banner }, 201)
	},

	async update(c: Context) {
		const id = parseId(c)
		const body = c.get('validated')
		const updated = await bannerService.update(id, body)
		if (!updated) throw ApiError.notFound('Banner not found')
		return c.json({ success: true, data: updated })
	},

	async delete(c: Context) {
		const id = parseId(c)
		const deleted = await bannerService.delete(id)
		if (!deleted) throw ApiError.notFound('Banner not found')
		return c.json({
			success: true,
			message: 'Banner deleted successfully',
		})
	},
}
