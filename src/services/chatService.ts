import { and, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '../db/db'
import {
	conversation_participants,
	conversations,
	messages,
} from '../db/schema'
import type { SendMessage } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { keyFromPublicUrl } from '../utils/storage/client'
import { storage } from '../utils/storage/instance'
import type { UserId } from '../utils/types'

// Canonical, order-independent key for a 1:1 chat — lets "find or create
// the conversation between these two users" be an atomic
// `ON CONFLICT DO NOTHING` on `conversations.direct_key` instead of a
// check-then-insert race.
function directKey(userA: UserId, userB: UserId): string {
	return [userA, userB].sort().join(':')
}

function buildPreview(data: SendMessage): string {
	if (data.kind === 'text') return data.content.slice(0, 200)
	if (data.kind === 'image') return '📷 Photo'
	return '🎤 Voice message'
}

// A user can only attach an upload keyed under their own id — this is the
// entire security model for chat attachments (see `instance.ts`'s image
// `buildKey` comment for the same pattern).
function assertOwnsAttachment(
	url: string,
	senderId: UserId,
	prefix: 'images' | 'voices',
) {
	const key = keyFromPublicUrl(url)
	if (!key || !key.startsWith(`${prefix}/${senderId}/`)) {
		throw ApiError.forbidden(
			'You can only send attachments you uploaded yourself',
		)
	}
}

async function validateAttachments(data: SendMessage, senderId: UserId) {
	if (data.kind === 'image') {
		for (const url of data.images) assertOwnsAttachment(url, senderId, 'images')
		await storage.validateNewImages(data.images)
	} else if (data.kind === 'voice') {
		assertOwnsAttachment(data.audio_url, senderId, 'voices')
		await storage.validateNewVoice(data.audio_url)
	}
}

export const chatService = {
	directKey,

	async isParticipant(
		conversationId: number,
		userId: UserId,
	): Promise<boolean> {
		const row = await db.query.conversation_participants.findFirst({
			where: and(
				eq(conversation_participants.conversation_id, conversationId),
				eq(conversation_participants.user_id, userId),
			),
			columns: { id: true },
		})
		return !!row
	},

	async getParticipantIds(conversationId: number): Promise<UserId[]> {
		const rows = await db
			.select({ user_id: conversation_participants.user_id })
			.from(conversation_participants)
			.where(eq(conversation_participants.conversation_id, conversationId))
		return rows.map((r) => r.user_id)
	},

	async findConversationBetween(userA: UserId, userB: UserId) {
		return db.query.conversations.findFirst({
			where: eq(conversations.direct_key, directKey(userA, userB)),
		})
	},

	// Resolves (finding-or-creating) the conversation, validates attachments,
	// inserts the message, and refreshes the conversation's denormalized
	// preview — all in one transaction so a reader never observes a message
	// without its conversation (or vice versa) having been updated.
	async sendMessage(senderId: UserId, data: SendMessage) {
		if (data.recipient_id === senderId) {
			throw ApiError.badRequest('Cannot message yourself')
		}
		await validateAttachments(data, senderId)

		return db.transaction(async (tx) => {
			let conversationId: number
			// True only when this call is the one that created the conversation
			// row — the ws layer uses this to know it must additionally
			// subscribe the sender's own connection to the new room (an
			// existing conversation's room is already subscribed from `onOpen`
			// or an earlier `join`).
			let created = false

			if (data.conversation_id != null) {
				const participant = await tx.query.conversation_participants.findFirst({
					where: and(
						eq(conversation_participants.conversation_id, data.conversation_id),
						eq(conversation_participants.user_id, senderId),
					),
				})
				if (!participant)
					throw ApiError.forbidden('Not a participant of this conversation')
				conversationId = data.conversation_id
			} else {
				if (!data.recipient_id) {
					throw ApiError.badRequest(
						'Either recipient_id or conversation_id is required',
					)
				}
				const recipientId = data.recipient_id
				const key = directKey(senderId, recipientId)

				const inserted = await tx
					.insert(conversations)
					.values({
						direct_key: key,
						last_message_sender_id: senderId,
						last_message_preview: '',
					})
					// The `where` here must mirror `conversations_direct_key_key`'s
					// partial predicate exactly — Postgres only infers a partial
					// unique index as the ON CONFLICT arbiter when the clause
					// matches; a plain `ON CONFLICT (direct_key)` won't match it.
					.onConflictDoNothing({
						target: conversations.direct_key,
						where: sql`${conversations.direct_key} is not null`,
					})
					.returning({ id: conversations.id })
				created = inserted.length > 0

				const conversation = created
					? inserted[0]
					: await tx.query.conversations.findFirst({
							where: eq(conversations.direct_key, key),
						})
				if (!conversation)
					throw ApiError.internal('Failed to resolve conversation')
				conversationId = conversation.id

				if (created) {
					await tx.insert(conversation_participants).values([
						{ conversation_id: conversationId, user_id: senderId },
						{ conversation_id: conversationId, user_id: recipientId },
					])
				}
			}

			const [message] = await tx
				.insert(messages)
				.values({
					conversation_id: conversationId,
					sender_id: senderId,
					kind: data.kind,
					content:
						data.kind === 'text'
							? data.content
							: data.kind === 'image'
								? (data.content ?? null)
								: null,
					images: data.kind === 'image' ? data.images : null,
					audio_url: data.kind === 'voice' ? data.audio_url : null,
					audio_duration_seconds:
						data.kind === 'voice' ? data.audio_duration_seconds : null,
				})
				.returning()
			if (!message) throw ApiError.internal('Failed to insert message')

			const preview = buildPreview(data)

			await tx
				.update(conversations)
				.set({
					last_message_at: message.created_at,
					last_message_preview: preview,
					last_message_sender_id: senderId,
				})
				.where(eq(conversations.id, conversationId))

			const participantRows = await tx
				.select({ user_id: conversation_participants.user_id })
				.from(conversation_participants)
				.where(eq(conversation_participants.conversation_id, conversationId))

			return {
				message,
				conversationId,
				created,
				preview,
				participantIds: participantRows.map((r) => r.user_id),
			}
		})
	},

	async listConversations(userId: UserId, limit: number, cursor?: CursorData) {
		const myConversationRows = await db
			.select({ conversation_id: conversation_participants.conversation_id })
			.from(conversation_participants)
			.where(eq(conversation_participants.user_id, userId))
		const myConversationIds = myConversationRows.map((r) => r.conversation_id)

		if (myConversationIds.length === 0) {
			return { conversations: [], nextCursor: null, hasMore: false }
		}

		const baseFilter = inArray(conversations.id, myConversationIds)
		// Ordered by `last_message_at`, not `created_at` (a conversation row's
		// `created_at` never changes after creation) — so the cursor condition
		// is built against that column directly rather than reusing
		// `buildCursorFilter`, which assumes `created_at` is the order column.
		const whereCondition = cursor
			? and(
					baseFilter,
					or(
						lt(conversations.last_message_at, new Date(cursor.created_at)),
						and(
							eq(conversations.last_message_at, new Date(cursor.created_at)),
							lt(conversations.id, Number(cursor.id)),
						),
					),
				)
			: baseFilter

		const rows = await db.query.conversations.findMany({
			where: whereCondition,
			orderBy: [desc(conversations.last_message_at), desc(conversations.id)],
			limit: limit + 1,
			with: {
				participants: {
					with: {
						user: { columns: { id: true, name: true, avatar_url: true } },
					},
				},
			},
		})

		const { list, nextCursor, hasMore } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.last_message_at })),
			limit,
		)

		const conversationIds = list.map((c) => c.id)
		const myParticipantRows = conversationIds.length
			? await db
					.select({
						conversation_id: conversation_participants.conversation_id,
						last_read_at: conversation_participants.last_read_at,
					})
					.from(conversation_participants)
					.where(
						and(
							inArray(
								conversation_participants.conversation_id,
								conversationIds,
							),
							eq(conversation_participants.user_id, userId),
						),
					)
			: []
		const myLastRead = new Map(
			myParticipantRows.map((r) => [r.conversation_id, r.last_read_at]),
		)

		const unreadCounts = await Promise.all(
			list.map(async (c) => {
				const lastRead = myLastRead.get(c.id)
				const [result] = await db
					.select({ count: sql<number>`count(*)::int` })
					.from(messages)
					.where(
						and(
							eq(messages.conversation_id, c.id),
							sql`${messages.sender_id} <> ${userId}`,
							lastRead ? gt(messages.created_at, lastRead) : sql`true`,
						),
					)
				return result?.count ?? 0
			}),
		)

		const conversationList = list.map((c, i) => {
			const other = c.participants.find((p) => p.user.id !== userId)?.user
			return {
				id: c.id,
				last_message_preview: c.last_message_preview,
				last_message_sender_id: c.last_message_sender_id,
				created_at: c.last_message_at,
				other_user: other ?? { id: '', name: 'Unknown', avatar_url: null },
				unread_count: unreadCounts[i] ?? 0,
			}
		})

		return { conversations: conversationList, nextCursor, hasMore }
	},

	async getOtherParticipantLastReadAt(conversationId: number, userId: UserId) {
		const row = await db.query.conversation_participants.findFirst({
			where: and(
				eq(conversation_participants.conversation_id, conversationId),
				sql`${conversation_participants.user_id} <> ${userId}`,
			),
			columns: { last_read_at: true },
		})
		return row?.last_read_at ?? null
	},

	async getMessages(
		conversationId: number,
		userId: UserId,
		limit: number,
		cursor?: CursorData,
	) {
		const isParticipant = await chatService.isParticipant(
			conversationId,
			userId,
		)
		if (!isParticipant) throw ApiError.forbidden()

		const baseFilter = eq(messages.conversation_id, conversationId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(messages, cursor))
			: baseFilter

		const results = await db.query.messages.findMany({
			where: whereCondition,
			orderBy: [desc(messages.created_at), desc(messages.id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		const otherLastReadAt = await chatService.getOtherParticipantLastReadAt(
			conversationId,
			userId,
		)
		return {
			messages: list,
			nextCursor,
			hasMore,
			other_last_read_at: otherLastReadAt,
		}
	},

	async getMessagesWithUser(
		otherUserId: UserId,
		userId: UserId,
		limit: number,
		cursor?: CursorData,
	) {
		const conversation = await chatService.findConversationBetween(
			userId,
			otherUserId,
		)
		if (!conversation) {
			return {
				messages: [],
				nextCursor: null,
				hasMore: false,
				other_last_read_at: null,
				conversation_id: null,
			}
		}
		const result = await chatService.getMessages(
			conversation.id,
			userId,
			limit,
			cursor,
		)
		return { ...result, conversation_id: conversation.id }
	},

	async markRead(conversationId: number, userId: UserId) {
		const isParticipant = await chatService.isParticipant(
			conversationId,
			userId,
		)
		if (!isParticipant) throw ApiError.forbidden()

		const readAt = new Date()
		await db
			.update(conversation_participants)
			.set({ last_read_at: readAt })
			.where(
				and(
					eq(conversation_participants.conversation_id, conversationId),
					eq(conversation_participants.user_id, userId),
				),
			)
		return readAt
	},
}
