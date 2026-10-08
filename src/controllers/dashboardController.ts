import type { Context } from 'hono'
import { dashboardService } from '../services/dashboardService.ts'
import { notificationDispatchService } from '../services/notificationDispatchService.ts'
import { pushNotificationService } from '../services/pushNotificationService.ts'
import { userService } from '../services/userService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { ReportType, UserId } from '../utils/types.ts'

export const dashboardController = {
	async createCategory(c: Context) {
		const body = c.get('validated')
		const data = await dashboardService.createCategory(body)
		return c.json({ success: true, data }, 201)
	},

	async updateCategory(c: Context) {
		const id = parseId(c)
		const body = c.get('validated')

		const updated = await dashboardService.updateCategory(id, body)
		if (!updated) throw ApiError.notFound('Category not found')
		return c.json({ success: true, data: updated })
	},

	async deleteCategory(c: Context) {
		const id = parseId(c)
		const deleted = await dashboardService.deleteCategory(id)
		if (!deleted) throw ApiError.notFound('Category not found')
		return c.json({
			success: true,
			message: 'Category deleted successfully',
		})
	},

	async createCategoryAttribute(c: Context) {
		const body = c.get('validated')
		const data = await dashboardService.createCategoryAttribute(body)
		return c.json({ success: true, data }, 201)
	},

	async updateCategoryAttribute(c: Context) {
		const id = parseId(c)
		const body = c.get('validated')

		const updated = await dashboardService.updateCategoryAttribute(id, body)
		if (!updated) throw ApiError.notFound('Category attribute not found')
		return c.json({ success: true, data: updated })
	},

	async deleteCategoryAttribute(c: Context) {
		const id = parseId(c)
		const deleted = await dashboardService.deleteCategoryAttribute(id)
		if (!deleted) throw ApiError.notFound('Category attribute not found')
		return c.json({
			success: true,
			message: 'Category attribute deleted successfully',
		})
	},

	async createProvince(c: Context) {
		const data = c.get('validated')
		const province = await dashboardService.createProvince(data)
		return c.json({ success: true, data: province }, 201)
	},

	async updateProvince(c: Context) {
		const id = parseId(c)
		const data = c.get('validated')
		const province = await dashboardService.updateProvince(id, data)
		if (!province) throw ApiError.notFound('Province not found')
		return c.json({ success: true, data: province })
	},

	async deleteProvince(c: Context) {
		const id = parseId(c)
		await dashboardService.deleteProvince(id)
		return c.json({ success: true, message: 'Province deleted successfully' })
	},

	async getAllReports(c: Context) {
		const type = c.req.query('type') as ReportType | undefined
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))

		const data = await dashboardService.getAllReports(limit, cursor, type)
		return c.json({ success: true, data })
	},

	async getUserReports(c: Context) {
		const userId = c.req.param('userId') as UserId
		const limit = 12
		const cursor = parseCursor(c.req.query('cursor'))

		const data = await dashboardService.getReportsByUser(userId, limit, cursor)
		return c.json({ success: true, data })
	},

	async updateReportStatus(c: Context) {
		const id = parseId(c)
		const { status } = c.get('validated')

		const result = await dashboardService.updateReportStatus(id, status)
		return c.json({ success: true, data: result })
	},

	async deleteReport(c: Context) {
		const id = parseId(c)
		const result = await dashboardService.deleteReport(id)
		return c.json({ success: true, data: result })
	},

	async sendBroadcast(c: Context) {
		const { title, body, segment, data } = c.get('validated')
		const admin = c.get('user')

		const recipients = await userService.getIdsBySegment(segment)
		await notificationDispatchService.notifyUsers({
			type: 'admin_broadcast',
			recipients,
			actorId: admin.id,
			data: { title, body, segment, ...data },
			push: { title, body },
		})

		return c.json({
			success: true,
			message: `Broadcast sent to ${recipients.length} users`,
		})
	},

	async getPushHealth(c: Context) {
		const stats = await pushNotificationService.getHealthStats()
		return c.json({ success: true, data: stats })
	},
}
