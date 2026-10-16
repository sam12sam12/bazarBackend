import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '../db/db'
import {
	conversation_participants,
	conversations,
	type MessageKind,
	messages,
	productRequests,
	products,
} from '../db/schema'
import type { SendMessage } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	cursorOrderBy,
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

// Shared projection for enriching a `product_reference`/`request_reference`
// message with its live listing — used both by sendMessage (right after
// insert, so the WS broadcast carries the full card) and getMessages (via
// the `with` relation join for history). Kept as one constant so the two
// call sites can't drift apart on which columns the client gets.
const REFERENCE_PRODUCT_COLUMNS = {
	id: true,
	title: true,
	images: true,
	price: true,
	currency: true,
} as const
const REFERENCE_REQUEST_COLUMNS = {
	id: true,
	title: true,
	images: true,
	budget_min: true,
	budget_max: true,
	currency: true,
} as const

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Shared by sendMessage (inside its transaction) and editMessage (a plain
// update, no transaction needed there) — see `Tx | typeof db` so the same
// function works in both. Editing only ever amends `content`, never which
// listing a reference message points at, but the *echoed* message still
// needs this attached every time — without it, a `message:updated` frame
// would carry `reference_product`/`reference_request` as `undefined`
// (not even `null`), and Bazar56's MessageBubble would read that as "no
// card to show" and drop it after every edit.
async function fetchReferenceData(
	executor: Tx | typeof db,
	kind: MessageKind,
	referenceProductId: number | null,
	referenceRequestId: number | null,
) {
	const referenceProduct =
		kind === 'product_reference' && referenceProductId != null
			? ((await executor.query.products.findFirst({
					where: eq(products.id, referenceProductId),
					columns: REFERENCE_PRODUCT_COLUMNS,
				})) ?? null)
			: null
	const referenceRequest =
		kind === 'request_reference' && referenceRequestId != null
			? ((await executor.query.productRequests.findFirst({
					where: eq(productRequests.id, referenceRequestId),
					columns: REFERENCE_REQUEST_COLUMNS,
				})) ?? null)
			: null
	return { referenceProduct, referenceRequest }
}

// Kind-specific fallback copy (no caption to show) is the client's job —
// see Bazar56's ChatUserCard, which renders an icon + a localized "Photo"/
// "Voice"/"Shared product"/"Shared request" label for a blank preview. This
// only ever carries real caption text (or '' when there isn't one); voice
// never has a caption at all (sendVoiceMessageSchema has no `content` field).
function buildPreview(data: SendMessage): string {
	if (data.kind === 'text') return data.content.slice(0, 200)
	if (
		data.kind === 'image' ||
		data.kind === 'product_reference' ||
		data.kind === 'request_reference'
	) {
		return (data.content ?? '').slice(0, 200)
	}
	return ''
}

// Sibling of buildPreview for recomputing a conversation's list preview
// from an already-stored row (editMessage/deleteMessage), rather than from
// the pre-insert data sendMessage has. Deleted is '' here, never a literal
// English string — "deleted" is carried as its own
// `conversations.last_message_deleted` flag (see refreshPreviewIfLatest)
// so the client can render it through its own translated copy instead of
// a hardcoded sentence that would never be translated for a Pashto/Dari
// user.
function previewForMessage(message: {
	kind: MessageKind
	content: string | null
	images: string[] | null
	deleted_at: Date | null
}): string {
	if (message.deleted_at) return ''
	if (
		message.kind === 'text' ||
		message.kind === 'image' ||
		message.kind === 'product_reference' ||
		message.kind === 'request_reference'
	) {
		return (message.content ?? '').slice(0, 200)
	}
	return ''
}

// Editing/deleting a message only needs to touch the conversation's
// denormalized `last_message_preview` when that message is still the
// *latest* one — editing/deleting something further back in history has no
// effect on the conversation list. Returns the new preview if it changed
// (so the caller knows to broadcast `conversation:updated`), `null`
// otherwise.
async function refreshPreviewIfLatest(
	conversationId: number,
	message: {
		id: number
		sender_id: UserId
		kind: MessageKind
		content: string | null
		images: string[] | null
		deleted_at: Date | null
	},
): Promise<string | null> {
	const [latest] = await db
		.select({ id: messages.id })
		.from(messages)
		.where(eq(messages.conversation_id, conversationId))
		.orderBy(...cursorOrderBy(messages))
		.limit(1)
	if (!latest || latest.id !== message.id) return null

	const preview = previewForMessage(message)
	await db
		.update(conversations)
		.set({
			last_message_preview: preview,
			last_message_deleted: !!message.deleted_at,
			last_message_sender_id: message.sender_id,
			last_message_kind: message.kind,
		})
		.where(eq(conversations.id, conversationId))
	return preview
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
	} else if (data.kind === 'product_reference') {
		const product = await db.query.products.findFirst({
			where: eq(products.id, data.reference_product_id),
			columns: { id: true },
		})
		if (!product) throw ApiError.notFound('Product not found')
	} else if (data.kind === 'request_reference') {
		const request = await db.query.productRequests.findFirst({
			where: eq(productRequests.id, data.reference_request_id),
			columns: { id: true },
		})
		if (!request) throw ApiError.notFound('Request not found')
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

	// Batched sibling of getParticipantIds — wsRouter.ts's onOpen/onClose
	// need every contact across *all* of a user's conversations, which was
	// previously one query per conversation (Promise.all over
	// getParticipantIds). One query, grouped client-side, instead.
	async getParticipantIdsForConversations(
		conversationIds: number[],
	): Promise<Map<number, UserId[]>> {
		const result = new Map<number, UserId[]>()
		if (conversationIds.length === 0) return result

		const rows = await db
			.select({
				conversation_id: conversation_participants.conversation_id,
				user_id: conversation_participants.user_id,
			})
			.from(conversation_participants)
			.where(
				inArray(conversation_participants.conversation_id, conversationIds),
			)

		for (const row of rows) {
			const existing = result.get(row.conversation_id)
			if (existing) existing.push(row.user_id)
			else result.set(row.conversation_id, [row.user_id])
		}
		return result
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
						store_id: data.store_id ?? null,
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
							: data.kind === 'image' ||
									data.kind === 'product_reference' ||
									data.kind === 'request_reference'
								? (data.content ?? null)
								: null,
					images: data.kind === 'image' ? data.images : null,
					audio_url: data.kind === 'voice' ? data.audio_url : null,
					audio_duration_seconds:
						data.kind === 'voice' ? data.audio_duration_seconds : null,
					reference_product_id:
						data.kind === 'product_reference' ? data.reference_product_id : null,
					reference_request_id:
						data.kind === 'request_reference' ? data.reference_request_id : null,
				})
				.returning()
			if (!message) throw ApiError.internal('Failed to insert message')

			// `.returning()` only gives back `messages`' own columns — fetch the
			// live listing here too so the WS `message:new` broadcast carries the
			// full reference card, not just the bare FK id the recipient would
			// otherwise have to resolve with a separate fetch. `null` for every
			// other kind, matching the shape getMessages' relation join returns.
			const { referenceProduct, referenceRequest } = await fetchReferenceData(
				tx,
				message.kind,
				message.reference_product_id,
				message.reference_request_id,
			)

			const preview = buildPreview(data)

			await tx
				.update(conversations)
				.set({
					last_message_at: message.created_at,
					last_message_preview: preview,
					last_message_sender_id: senderId,
					last_message_kind: data.kind,
					last_message_deleted: false,
				})
				.where(eq(conversations.id, conversationId))

			const participantRows = await tx
				.select({ user_id: conversation_participants.user_id })
				.from(conversation_participants)
				.where(eq(conversation_participants.conversation_id, conversationId))

			return {
				message: { ...message, reference_product: referenceProduct, reference_request: referenceRequest },
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
		// `created_at` never changes after creation) — same row-value cursor
		// comparison as `buildCursorFilter`, just built against that column
		// directly since `buildCursorFilter` itself assumes `created_at` is
		// the order column.
		const whereCondition = cursor
			? and(
					baseFilter,
					sql`(${conversations.last_message_at}, ${conversations.id}) < (${new Date(cursor.created_at)}, ${Number(cursor.id)})`,
				)
			: baseFilter

		const rows = await db.query.conversations.findMany({
			where: whereCondition,
			orderBy: [
				sql`${conversations.last_message_at} desc nulls last`,
				sql`${conversations.id} desc nulls last`,
			],
			limit: limit + 1,
			with: {
				participants: {
					with: {
						user: { columns: { id: true, name: true, avatar_url: true } },
					},
				},
				store: { columns: { id: true, name: true, logo_url: true } },
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
				last_message_kind: c.last_message_kind,
				last_message_deleted: c.last_message_deleted,
				last_message_sender_id: c.last_message_sender_id,
				// Computed server-side against the requesting session — callers
				// (ChatUserCard) should never re-derive this by comparing
				// `last_message_sender_id` to their own id client-side.
				is_mine: c.last_message_sender_id === userId,
				created_at: c.last_message_at,
				other_user: other ?? { id: '', name: 'Unknown', avatar_url: null },
				// Set once at creation when this chat started from a product/
				// store entry point — `null` for a request-originated or any
				// other non-store chat. Callers (ChatUserCard) should prefer
				// this over `other_user` for display name/avatar whenever it's
				// present, so a store-branded conversation stays branded on
				// every revisit, not just the first open.
				store: c.store ?? null,
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
			orderBy: [...cursorOrderBy(messages)],
			limit: limit + 1,
			// Enriches `product_reference`/`request_reference` messages with the
			// live listing so the client can render a shared-listing card
			// without a second round trip — a live join, not a snapshot, since
			// neither products nor requests are ever hard-deleted (see
			// chatSchema's comment on these columns).
			with: {
				referenceProduct: { columns: REFERENCE_PRODUCT_COLUMNS },
				referenceRequest: { columns: REFERENCE_REQUEST_COLUMNS },
			},
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		const otherLastReadAt = await chatService.getOtherParticipantLastReadAt(
			conversationId,
			userId,
		)
		// Computed server-side against the requesting session — callers
		// (ChatMessagesScreen) should never re-derive this by comparing
		// `sender_id` to their own id client-side.
		// `referenceProduct`/`referenceRequest` are Drizzle's relation-key
		// casing (camelCase, like every other relation name in relations.ts) —
		// renamed to snake_case here so the wire response stays consistent
		// with every other field this API returns.
		const messagesWithIsMine = list.map((m) => {
			const { referenceProduct, referenceRequest, ...rest } = m
			return {
				...rest,
				is_mine: m.sender_id === userId,
				reference_product: referenceProduct,
				reference_request: referenceRequest,
			}
		})
		return {
			messages: messagesWithIsMine,
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

	// Only the sender may edit their own message, only while it isn't
	// deleted, and only text — WhatsApp-style, editing a photo/voice note
	// isn't a thing since there's no separate caption field to amend. There's
	// no edit-history table, so the previous content isn't recoverable once
	// edited.
	async editMessage(
		messageId: number,
		conversationId: number,
		userId: UserId,
		content: string,
	) {
		const [current] = await db
			.select()
			.from(messages)
			.where(eq(messages.id, messageId))
			.limit(1)
		if (!current || current.conversation_id !== conversationId) {
			throw ApiError.notFound('Message not found')
		}
		if (current.sender_id !== userId) {
			throw ApiError.forbidden('You can only edit your own messages')
		}
		if (current.deleted_at) {
			throw ApiError.forbidden('Cannot edit a deleted message')
		}
		// Text: always editable. Image/product_reference/request_reference:
		// only if they already carry a caption — WhatsApp-style, this amends
		// the existing caption, it doesn't add one to a photo/listing that
		// never had text (that's a different feature). Voice has no text
		// field of its own to amend at all.
		if (current.kind === 'voice') {
			throw ApiError.badRequest('Voice messages cannot be edited')
		}
		if (
			(current.kind === 'image' ||
				current.kind === 'product_reference' ||
				current.kind === 'request_reference') &&
			!current.content
		) {
			throw ApiError.badRequest('This message has no caption to edit')
		}

		const [updated] = await db
			.update(messages)
			.set({ content, edited_at: new Date() })
			.where(eq(messages.id, messageId))
			.returning()
		if (!updated) throw ApiError.internal('Failed to edit message')

		// Editing only ever amends `content` — never which listing a reference
		// message points at — but `.returning()` still only gives back
		// `messages`' own columns, so the echoed row needs this re-attached
		// every time, same reasoning as sendMessage's own fetch.
		const { referenceProduct, referenceRequest } = await fetchReferenceData(
			db,
			updated.kind,
			updated.reference_product_id,
			updated.reference_request_id,
		)

		const preview = await refreshPreviewIfLatest(conversationId, updated)
		const participantIds = await chatService.getParticipantIds(conversationId)
		return {
			message: {
				...updated,
				reference_product: referenceProduct,
				reference_request: referenceRequest,
			},
			participantIds,
			preview,
		}
	},

	// Soft delete — WhatsApp-style "delete for everyone," not a hide-for-me.
	// Clears the payload columns (regardless of `kind`) and stamps
	// `deleted_at`; the row itself stays so pagination/ordering/preview
	// logic never has to special-case a hole in the sequence. Idempotent:
	// deleting an already-deleted message re-returns its current state
	// instead of erroring, since a client retry/double-tap shouldn't be
	// treated as a failure.
	async deleteMessage(
		messageId: number,
		conversationId: number,
		userId: UserId,
	) {
		const [current] = await db
			.select()
			.from(messages)
			.where(eq(messages.id, messageId))
			.limit(1)
		if (!current || current.conversation_id !== conversationId) {
			throw ApiError.notFound('Message not found')
		}
		if (current.sender_id !== userId) {
			throw ApiError.forbidden('You can only delete your own messages')
		}

		const [updated] = current.deleted_at
			? [current]
			: await db
					.update(messages)
					.set({
						content: null,
						images: null,
						audio_url: null,
						audio_duration_seconds: null,
						deleted_at: new Date(),
					})
					.where(eq(messages.id, messageId))
					.returning()
		if (!updated) throw ApiError.internal('Failed to delete message')

		// Clearing the row's columns above doesn't touch R2 on its own — once
		// nothing references an uploaded image/voice object, it's this app's
		// job to delete it. Only on the actual delete, not the idempotent
		// re-delete branch above — the first delete already cleaned these up.
		if (!current.deleted_at) {
			if (current.kind === 'image' && current.images?.length) {
				await storage.reconcileImages(current.images, [])
			} else if (current.kind === 'voice' && current.audio_url) {
				await storage.reconcileImage(current.audio_url, null)
			}
		}

		const preview = await refreshPreviewIfLatest(conversationId, updated)
		const participantIds = await chatService.getParticipantIds(conversationId)
		return { message: updated, participantIds, preview }
	},
}
