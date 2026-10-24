import type { Context } from 'hono'
import {
	type NotificationCategory,
	notificationService,
} from '../services/notificationService.ts'
import { ApiError } from '../utils/ApiError'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { UserId } from '../utils/types.ts'

const VALID_CATEGORIES: NotificationCategory[] = [
	'order',
	'promo',
	'message',
	'system',
]

export const notificationController = {
	async getByUser(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		if (currentUser.id !== userId && !isAdmin) throw ApiError.forbidden()

		const limit = 12
		const cursor = c.req.query('cursor')
		const parsedCursor = parseCursor(cursor)
		const categoryParam = c.req.query('category')
		const category = VALID_CATEGORIES.includes(
			categoryParam as NotificationCategory,
		)
			? (categoryParam as NotificationCategory)
			: undefined

		const { notifications, nextCursor, hasMore } =
			await notificationService.getByUserId(
				userId,
				limit,
				parsedCursor,
				category,
			)
		return c.json({
			success: true,
			data: { notifications, nextCursor, hasMore },
		})
	},

	async getUnreadCount(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		if (currentUser.id !== userId && !isAdmin) throw ApiError.forbidden()

		const count = await notificationService.getUnreadCount(userId)
		return c.json({ success: true, data: { count } })
	},

	async markAsRead(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const notification = await notificationService.getById(id)
		if (!notification) throw ApiError.notFound('Notification not found')
		if (notification.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		await notificationService.markAsRead(id)
		return c.json({ success: true, message: 'Notification marked as read' })
	},

	async markAllAsRead(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		if (currentUser.id !== userId && !isAdmin) throw ApiError.forbidden()

		await notificationService.markAllAsRead(userId)
		return c.json({
			success: true,
			message: 'All notifications marked as read',
		})
	},

	async create(c: Context) {
		const data = c.get('validated')
		const notification = await notificationService.create(data)
		return c.json({ success: true, data: notification }, 201)
	},

	async delete(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const notification = await notificationService.getById(id)
		if (!notification) throw ApiError.notFound('Notification not found')
		if (notification.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		await notificationService.delete(id)
		return c.json({
			success: true,
			message: 'Notification deleted successfully',
		})
	},
}
