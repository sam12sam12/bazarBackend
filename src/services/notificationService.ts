import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { notifications } from '../db/schema'
import type { InsertNotification } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import type { UserId } from '../utils/types'

export const notificationService = {
	async getByUserId(userId: UserId, limit: number, cursor?: CursorData) {
		const baseFilter = eq(notifications.user_id, userId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(notifications, cursor))
			: baseFilter

		const results = await db.query.notifications.findMany({
			where: whereCondition,
			with: {
				actor: {
					columns: { name: true, avatar_url: true, id: true },
				},
				product: {
					columns: { id: true, title: true },
				},
			},
			orderBy: [desc(notifications.created_at), desc(notifications.id)],
			limit: limit + 1,
		})

		const {
			list: notificationList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { notifications: notificationList, nextCursor, hasMore }
	},

	async getUnreadCount(userId: UserId) {
		const [result] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(notifications)
			.where(
				and(
					eq(notifications.user_id, userId),
					eq(notifications.is_read, false),
				),
			)
		return result?.count ?? 0
	},

	async markAsRead(id: number) {
		await db
			.update(notifications)
			.set({ is_read: true })
			.where(eq(notifications.id, id))
		return true
	},

	async markAllAsRead(userId: UserId) {
		await db
			.update(notifications)
			.set({ is_read: true })
			.where(
				and(
					eq(notifications.user_id, userId),
					eq(notifications.is_read, false),
				),
			)
		return true
	},

	async create(data: InsertNotification) {
		await db.insert(notifications).values(data)
		return 'Notification created successfully'
	},

	async delete(id: number) {
		await db.delete(notifications).where(eq(notifications.id, id))
		return true
	},

	async getById(id: number) {
		return db.query.notifications.findFirst({
			where: eq(notifications.id, id),
			columns: { id: true, user_id: true },
		})
	},
}
