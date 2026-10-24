import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import {
	Expo,
	type ExpoPushMessage,
	type ExpoPushTicket,
} from 'expo-server-sdk'
import { db } from '../db/db'
import { notificationPreferences, pushTokens } from '../db/schema'

const expo = new Expo()

// Keyset page size for sendBroadcastToAll — kept well under Expo's own
// 100-message chunk size (sendMessages re-chunks each page anyway) so a
// broadcast to a large table never pulls every token into memory at once.
const BROADCAST_DB_BATCH_SIZE = 500

// Maps a push category to the notification_preferences column that gates
// it. `null` means "always send, never filtered" (admin_broadcast).
const PREFERENCE_COLUMN = {
	new_store_product: notificationPreferences.new_store_product,
	new_message: notificationPreferences.new_message,
	order_status_changed: notificationPreferences.order_status_changed,
	review_received: notificationPreferences.review_received,
} as const

export type PushCategory = keyof typeof PREFERENCE_COLUMN

export const pushNotificationService = {
	/**
	 * Looks up push tokens for the given users, filters out anyone who has
	 * muted this category (a user with no preferences row yet is treated as
	 * "all on"), chunks, and sends via Expo. Never throws — push delivery is
	 * always best-effort relative to the in-app notification row that already
	 * landed in the DB.
	 */
	async sendToUsers(
		userIds: string[],
		category: PushCategory | null,
		payload: { title: string; body: string; data?: Record<string, unknown> },
	) {
		if (userIds.length === 0) return

		const prefColumn = category ? PREFERENCE_COLUMN[category] : null

		const rows = await db
			.select({ user_id: pushTokens.user_id, token: pushTokens.token })
			.from(pushTokens)
			.leftJoin(
				notificationPreferences,
				eq(notificationPreferences.user_id, pushTokens.user_id),
			)
			.where(
				prefColumn
					? and(
							inArray(pushTokens.user_id, userIds),
							sql`COALESCE(${prefColumn}, true) = true`,
						)
					: inArray(pushTokens.user_id, userIds),
			)

		const messages: ExpoPushMessage[] = rows
			.filter((r) => Expo.isExpoPushToken(r.token))
			.map((r) => ({
				to: r.token,
				sound: 'default',
				title: payload.title,
				body: payload.body,
				data: payload.data ?? {},
			}))

		await this.sendMessages(messages)
	},

	/**
	 * Sends to every registered device regardless of identity — signed-in
	 * users and anonymous (not-signed-in) devices alike. No preference
	 * filtering applies (there's no notification_preferences row for an
	 * anonymous device), so this is for broadcast/marketing sends only,
	 * same as the admin_broadcast category.
	 *
	 * Streams the table in keyset-paginated batches (ordered by `id`,
	 * `WHERE id > cursor`) rather than loading every token into memory —
	 * a `push_tokens` table with hundreds of thousands of rows should
	 * never turn into one giant SELECT. Each DB batch is handed off to
	 * `sendMessages` immediately, which re-chunks it to Expo's own
	 * 100-message limit, so memory stays bounded by one DB batch plus one
	 * Expo chunk at a time, not the whole table.
	 */
	async sendBroadcastToAll(payload: {
		title: string
		body: string
		data?: Record<string, unknown>
	}) {
		let cursor = 0
		while (true) {
			const rows = await db
				.select({ id: pushTokens.id, token: pushTokens.token })
				.from(pushTokens)
				.where(gt(pushTokens.id, cursor))
				.orderBy(pushTokens.id)
				.limit(BROADCAST_DB_BATCH_SIZE)

			if (rows.length === 0) break

			const messages: ExpoPushMessage[] = rows
				.filter((r) => Expo.isExpoPushToken(r.token))
				.map((r) => ({
					to: r.token,
					sound: 'default',
					title: payload.title,
					body: payload.body,
					data: payload.data ?? {},
				}))

			await this.sendMessages(messages)

			cursor = rows.at(-1)?.id ?? cursor
			if (rows.length < BROADCAST_DB_BATCH_SIZE) break
		}
	},

	async sendMessages(messages: ExpoPushMessage[]) {
		if (messages.length === 0) return

		const chunks = expo.chunkPushNotifications(messages)
		for (const chunk of chunks) {
			try {
				const tickets = await expo.sendPushNotificationsAsync(chunk)
				await this.pruneFromTickets(chunk, tickets)
			} catch (err) {
				console.error('[push] chunk send failed:', err)
			}
		}
	},

	// A `DeviceNotRegistered` ticket error means the token is dead (app
	// uninstalled, token stale) — drop it so future sends stop wasting a
	// round-trip on it. Expo's receipt endpoint is the "proper" way to catch
	// this (tickets are the enqueue result, not the delivery result), but it
	// also surfaces this specific error reliably at ticket time in practice,
	// and polling receipts would need a delayed job for marginal gain in v1.
	async pruneFromTickets(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]) {
		for (let i = 0; i < tickets.length; i++) {
			const ticket = tickets[i]
			if (
				ticket?.status === 'error' &&
				ticket.details?.error === 'DeviceNotRegistered'
			) {
				const token = chunk[i]?.to
				if (typeof token === 'string') await this.pruneToken(token)
			}
		}
	},

	async pruneToken(token: string) {
		await db.delete(pushTokens).where(eq(pushTokens.token, token))
	},

	async getHealthStats() {
		const [totalRow] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(pushTokens)

		const byPlatformRows = await db
			.select({
				platform: pushTokens.platform,
				count: sql<number>`count(*)::int`,
			})
			.from(pushTokens)
			.groupBy(pushTokens.platform)

		return {
			activeTokens: totalRow?.count ?? 0,
			byPlatform: Object.fromEntries(
				byPlatformRows.map((r) => [r.platform, r.count]),
			),
		}
	},
}
