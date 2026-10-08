import { db } from '../db/db'
import { notifications } from '../db/schema'
import type { notificationTypeEnum } from '../db/schema/_shared'
import {
	type PushCategory,
	pushNotificationService,
} from './pushNotificationService'

type NotificationType = (typeof notificationTypeEnum.enumValues)[number]

// Types not listed here (new_follower, new_order, new_similar_product,
// bid_received, offer_accepted, review_received, report_received) stay
// in-app-only in v1 — callers simply omit `push` for those.
const PUSH_CATEGORY: Partial<Record<NotificationType, PushCategory>> = {
	new_store_product: 'new_store_product',
	new_message: 'new_message',
	order_status_changed: 'order_status_changed',
}

type NotifyUsersInput = {
	type: NotificationType
	recipients: string[]
	actorId: string
	productId?: number
	messageId?: number
	data?: Record<string, unknown>
	// Omit to keep this trigger in-app-only; pass to also fire a push.
	push?: { title: string; body: string }
}

export const notificationDispatchService = {
	// Single entry point for every notification trigger: writes the in-app
	// row(s) and, if `push` is given, fans the push out through
	// pushNotificationService (which applies per-category preference
	// filtering, except for admin_broadcast, which always sends).
	async notifyUsers(input: NotifyUsersInput) {
		if (input.recipients.length === 0) return

		await db.insert(notifications).values(
			input.recipients.map((userId) => ({
				user_id: userId,
				actor_id: input.actorId,
				type: input.type,
				product_id: input.productId ?? null,
				message_id: input.messageId ?? null,
				data: input.data ?? {},
			})),
		)

		if (!input.push) return

		const category =
			input.type === 'admin_broadcast' ? null : PUSH_CATEGORY[input.type]
		if (category === undefined) return // this type never pushes

		await pushNotificationService.sendToUsers(input.recipients, category, {
			title: input.push.title,
			body: input.push.body,
			data: {
				type: input.type,
				product_id: input.productId,
				message_id: input.messageId,
				...input.data,
			},
		})
	},
}
