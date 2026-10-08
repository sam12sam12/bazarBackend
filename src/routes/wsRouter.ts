import type { ServerWebSocket } from 'bun'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { z } from 'zod'
import { db } from '../db/db.ts'
import { conversation_participants } from '../db/schema'
import {
	sendImageMessageSchema,
	sendTextMessageSchema,
	sendVoiceMessageSchema,
} from '../db/validation.ts'
import { fanoutBroadcast, fanoutFromConnection } from '../lib/fanout.ts'
import {
	getOnlineUserIds,
	registerConnection,
	unregisterConnection,
} from '../lib/presence.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { chatService } from '../services/chatService.ts'
import { notificationDispatchService } from '../services/notificationDispatchService.ts'

// WebSocket protocol frames — not table-backed REST bodies, so they live
// here rather than db/validation.ts. `message:send` nests a `kind`-
// discriminated union inside this `type`-discriminated one, which is why
// the outer union is a plain `z.union`, not `z.discriminatedUnion` (that
// helper requires every member's discriminant to be a literal directly on
// the object, and a nested union isn't that).
const messageSendFrame = z
	.union([
		sendTextMessageSchema.extend({
			type: z.literal('message:send'),
			client_id: z.string().optional(),
		}),
		sendImageMessageSchema.extend({
			type: z.literal('message:send'),
			client_id: z.string().optional(),
		}),
		sendVoiceMessageSchema.extend({
			type: z.literal('message:send'),
			client_id: z.string().optional(),
		}),
	])
	.refine((data) => data.conversation_id != null || data.recipient_id != null, {
		message: 'Either conversation_id or recipient_id is required',
		path: ['conversation_id'],
	})

const clientMessageSchema = z.union([
	z.object({
		type: z.literal('join'),
		conversation_id: z.number().int().positive(),
	}),
	messageSendFrame,
	z.object({
		type: z.literal('typing:start'),
		conversation_id: z.number().int().positive(),
	}),
	z.object({
		type: z.literal('typing:stop'),
		conversation_id: z.number().int().positive(),
	}),
	z.object({
		type: z.literal('recording:start'),
		conversation_id: z.number().int().positive(),
	}),
	z.object({
		type: z.literal('recording:stop'),
		conversation_id: z.number().int().positive(),
	}),
	z.object({
		type: z.literal('read'),
		conversation_id: z.number().int().positive(),
	}),
])

const conversationTopic = (id: number) => `conversation:${id}`
const userTopic = (userId: string) => `user:${userId}`

async function getConversationIds(userId: string): Promise<number[]> {
	const rows = await db
		.select({ conversation_id: conversation_participants.conversation_id })
		.from(conversation_participants)
		.where(eq(conversation_participants.user_id, userId))
	return rows.map((r) => r.conversation_id)
}

async function contactsFor(
	conversationIds: number[],
	excludingUserId: string,
): Promise<string[]> {
	const allParticipants = await Promise.all(
		conversationIds.map((id) => chatService.getParticipantIds(id)),
	)
	return [
		...new Set(allParticipants.flat().filter((id) => id !== excludingUserId)),
	]
}

const router = new Hono()

// Auth happens before the upgrade (`authMiddleware`, same Bearer-token
// check every other authenticated route uses) — an unauthenticated request
// never becomes a WebSocket, it just gets the normal 401 JSON response
// through the global error handler.
router.get(
	'/',
	authMiddleware,
	upgradeWebSocket((c) => {
		const user = c.get('user') as { id: string; name: string }
		// Populated in onOpen, kept current as new conversations start during
		// this connection's lifetime — reused in onClose so presence can be
		// broadcast to every contact this user is actually in a conversation
		// with, without a second DB round-trip at disconnect time.
		let conversationIds: number[] = []

		return {
			async onOpen(_evt, ws) {
				const raw = ws.raw as ServerWebSocket<unknown>
				conversationIds = await getConversationIds(user.id)

				raw.subscribe(userTopic(user.id))
				for (const id of conversationIds) raw.subscribe(conversationTopic(id))

				const contacts = await contactsFor(conversationIds, user.id)

				// Tell this client who's already online immediately — presence
				// events only fire on state *changes*, so without this it would
				// have to wait for a contact's next connect/disconnect.
				ws.send(
					JSON.stringify({
						type: 'ready',
						online_user_ids: getOnlineUserIds(contacts),
					}),
				)

				const justCameOnline = registerConnection(user.id)
				if (justCameOnline) {
					const payload = JSON.stringify({
						type: 'presence',
						user_id: user.id,
						online: true,
					})
					for (const contactId of contacts)
						fanoutBroadcast(userTopic(contactId), payload)
				}
			},

			async onMessage(evt, ws) {
				const raw = ws.raw as ServerWebSocket<unknown>

				let parsed: z.infer<typeof clientMessageSchema>
				try {
					parsed = clientMessageSchema.parse(JSON.parse(String(evt.data)))
				} catch {
					ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' }))
					return
				}

				try {
					switch (parsed.type) {
						case 'join': {
							const member = await chatService.isParticipant(
								parsed.conversation_id,
								user.id,
							)
							if (!member) {
								ws.send(
									JSON.stringify({ type: 'error', error: 'Not a participant' }),
								)
								return
							}
							raw.subscribe(conversationTopic(parsed.conversation_id))
							if (!conversationIds.includes(parsed.conversation_id)) {
								conversationIds.push(parsed.conversation_id)
							}
							return
						}

						case 'message:send': {
							const { client_id, type, ...data } = parsed
							const {
								message,
								conversationId,
								created,
								participantIds,
								preview,
							} = await chatService.sendMessage(user.id, data)

							if (created) {
								raw.subscribe(conversationTopic(conversationId))
								conversationIds.push(conversationId)
							}

							// `fanoutFromConnection` (not `fanoutBroadcast`) — it
							// excludes this exact connection by default, so the
							// sender's other open devices get it via the room while
							// this connection's own optimistic UI is reconciled
							// below via the direct `ws.send` instead of a duplicate.
							const newMessagePayload = JSON.stringify({
								type: 'message:new',
								message,
								client_id,
							})
							fanoutFromConnection(
								raw,
								conversationTopic(conversationId),
								newMessagePayload,
							)
							ws.send(newMessagePayload)

							const updatePayload = JSON.stringify({
								type: 'conversation:updated',
								conversation_id: conversationId,
								last_message_preview: preview,
								last_message_sender_id: user.id,
								created_at: message.created_at,
							})
							for (const participantId of participantIds) {
								fanoutFromConnection(
									raw,
									userTopic(participantId),
									updatePayload,
								)
							}

							// Push only to recipients with no live connection at all —
							// anyone online will see the WS events above instead.
							const onlineIds = getOnlineUserIds(participantIds)
							const offlineRecipients = participantIds.filter(
								(id) => id !== user.id && !onlineIds.includes(id),
							)
							notificationDispatchService
								.notifyUsers({
									type: 'new_message',
									recipients: offlineRecipients,
									actorId: user.id,
									messageId: message.id,
									data: {
										title: 'New Message',
										preview,
										conversation_id: conversationId,
									},
									push: { title: user.name, body: preview },
								})
								.catch((err) =>
									console.error('[chat] failed to notify recipients:', err),
								)
							return
						}

						case 'typing:start':
						case 'typing:stop': {
							const member = await chatService.isParticipant(
								parsed.conversation_id,
								user.id,
							)
							if (!member) return
							fanoutFromConnection(
								raw,
								conversationTopic(parsed.conversation_id),
								JSON.stringify({
									type: 'typing',
									conversation_id: parsed.conversation_id,
									user_id: user.id,
									is_typing: parsed.type === 'typing:start',
								}),
							)
							return
						}

						case 'recording:start':
						case 'recording:stop': {
							const member = await chatService.isParticipant(
								parsed.conversation_id,
								user.id,
							)
							if (!member) return
							fanoutFromConnection(
								raw,
								conversationTopic(parsed.conversation_id),
								JSON.stringify({
									type: 'recording',
									conversation_id: parsed.conversation_id,
									user_id: user.id,
									is_recording: parsed.type === 'recording:start',
								}),
							)
							return
						}

						case 'read': {
							const readAt = await chatService.markRead(
								parsed.conversation_id,
								user.id,
							)
							fanoutFromConnection(
								raw,
								conversationTopic(parsed.conversation_id),
								JSON.stringify({
									type: 'read',
									conversation_id: parsed.conversation_id,
									user_id: user.id,
									read_at: readAt,
								}),
							)
							return
						}
					}
				} catch (err) {
					const message =
						err instanceof Error ? err.message : 'Something went wrong'
					console.error(
						`wsRouter: ${parsed?.type ?? 'unknown'} failed for user ${user.id}:`,
						message,
					)
					// `client_id` lets the client roll back the specific optimistic
					// message that failed — without it a failed `message:send`
					// (e.g. attachment validation) is indistinguishable from any
					// other error.
					const clientId =
						parsed?.type === 'message:send' ? parsed.client_id : undefined
					ws.send(
						JSON.stringify({
							type: 'error',
							error: message,
							client_id: clientId,
						}),
					)
				}
			},

			async onClose() {
				const justWentOffline = unregisterConnection(user.id)
				if (!justWentOffline) return

				const contacts = await contactsFor(conversationIds, user.id)
				const payload = JSON.stringify({
					type: 'presence',
					user_id: user.id,
					online: false,
				})
				for (const contactId of contacts)
					fanoutBroadcast(userTopic(contactId), payload)
			},
		}
	}),
)

export default router
