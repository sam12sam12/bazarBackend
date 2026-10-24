import { db } from '../db/db'
import { notifications } from '../db/schema'
import type { notificationTypeEnum } from '../db/schema/_shared'
import {
	type PushCategory,
	pushNotificationService,
} from './pushNotificationService'

type NotificationType = (typeof notificationTypeEnum.enumValues)[number]

// Types not listed here (new_order, new_similar_product, bid_received,
// offer_accepted) stay in-app-only in v1 — callers simply omit `push` for
// those. `new_follower` and `report_received` aren't listed here either,
// but unlike those they still always push — see the `admin_broadcast`-style
// special case below.
const PUSH_CATEGORY: Partial<Record<NotificationType, PushCategory>> = {
	new_store_product: 'new_store_product',
	new_message: 'new_message',
	order_status_changed: 'order_status_changed',
	review_received: 'review_received',
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

		// `admin_broadcast`, `new_follower`, and `report_received` all always
		// push — none is gated by a `notification_preferences` column, so all
		// three resolve to a `null` category (sendToUsers skips the
		// preference lookup entirely for a `null` category, see
		// pushNotificationService).
		const category =
			input.type === 'admin_broadcast' ||
			input.type === 'new_follower' ||
			input.type === 'report_received'
				? null
				: PUSH_CATEGORY[input.type]
		if (category === undefined) return // this type never pushes

		await pushNotificationService.sendToUsers(input.recipients, category, {
			title: input.push.title,
			body: input.push.body,
			data: {
				type: input.type,
				actor_id: input.actorId,
				product_id: input.productId,
				message_id: input.messageId,
				...input.data,
			},
		})
	},
}
