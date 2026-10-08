import type { Context } from 'hono'
import { reportService } from '../services/reportService'
import { ApiError } from '../utils/ApiError'
import { parseCursor } from '../utils/pagination'

export const reportController = {
	async createReport(c: Context) {
		const currentUser = c.get('user')
		const data = c.get('validated')
		const report = await reportService.createReport(currentUser.id, data)
		return c.json({ success: true, data: report })
	},

	async getAllReports(c: Context) {
		const currentUser = c.get('user')
		if ((currentUser as { role?: string }).role !== 'admin')
			throw ApiError.forbidden()

		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const { reports, nextCursor } = await reportService.getAllReports(
			limit,
			parsedCursor,
		)
		return c.json({ success: true, data: reports, nextCursor })
	},

	async getUserReports(c: Context) {
		const currentUser = c.get('user')
		const limit = 12
		const parsedCursor = parseCursor(c.req.query('cursor'))

		const { reports, nextCursor } = await reportService.getUserReports(
			currentUser.id,
			limit,
			parsedCursor,
		)
		return c.json({ success: true, data: reports, nextCursor })
	},
}
