import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { notifications } from '../db/schema'
import type { notificationTypeEnum } from '../db/schema/_shared'
import type { InsertNotification } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import type { UserId } from '../utils/types'

type NotificationType = (typeof notificationTypeEnum.enumValues)[number]

export type NotificationCategory = 'order' | 'promo' | 'message' | 'system'

// Mirrors Bazar56's `categoryForNotificationType`
// (src/utils/constants/notificationStatus.ts) — the UI's 4-tab filter set,
// grouping the backend's finer-grained types. Kept in sync by hand since
// the two apps don't share code; if a new notification type is added,
// update both.
const CATEGORY_TYPES: Record<NotificationCategory, NotificationType[]> = {
	order: [
		'new_order',
		'order_status_changed',
		'bid_received',
		'offer_accepted',
	],
	promo: ['new_similar_product', 'new_store_product'],
	message: ['new_message'],
	system: [
		'new_follower',
		'review_received',
		'review_reply',
		'report_received',
		'admin_broadcast',
	],
}

export const notificationService = {
	async getByUserId(
		userId: UserId,
		limit: number,
		cursor?: CursorData,
		category?: NotificationCategory,
	) {
		const conditions: SQL[] = [eq(notifications.user_id, userId)]
		if (category)
			conditions.push(inArray(notifications.type, CATEGORY_TYPES[category]))
		if (cursor) conditions.push(buildCursorFilter(notifications, cursor) as SQL)
		const whereCondition = and(...conditions)

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
