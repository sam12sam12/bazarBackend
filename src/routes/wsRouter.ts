import type { ServerWebSocket } from 'bun'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { z } from 'zod'
import { db } from '../db/db.ts'
import { conversation_participants } from '../db/schema'
import {
	sendImageMessageSchema,
	sendProductReferenceMessageSchema,
	sendRequestReferenceMessageSchema,
	sendTextMessageSchema,
	sendVoiceMessageSchema,
} from '../db/validation.ts'
import { fanoutBroadcast, fanoutFromConnection } from '../lib/fanout.ts'
import {
	getOnlineUserIds,
	refreshConnection,
	registerConnection,
	unregisterConnection,
} from '../lib/presence.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { createRateLimiter } from '../middlewares/rateLimitMiddleware.ts'
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
		sendProductReferenceMessageSchema.extend({
			type: z.literal('message:send'),
			client_id: z.string().optional(),
		}),
		sendRequestReferenceMessageSchema.extend({
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
	// WhatsApp-style edit/delete — see chatService.editMessage/deleteMessage
	// for the ownership/kind/already-deleted rules each enforces server-side.
	z.object({
		type: z.literal('message:edit'),
		conversation_id: z.number().int().positive(),
		message_id: z.number().int().positive(),
		content: z.string().trim().min(1).max(2000),
	}),
	z.object({
		type: z.literal('message:delete'),
		conversation_id: z.number().int().positive(),
		message_id: z.number().int().positive(),
	}),
	// Lets a client learn (and keep learning) a specific user's online status
	// even with no conversation between them yet — e.g. a store's profile
	// screen, or a "message this user" entry point before the first message
	// is sent. `contactsFor`/`getConversationIds` below only cover people
	// already sharing a conversation, so without this a brand-new contact's
	// online dot would never appear until some conversation existed and
	// either side reconnected.
	z.object({
		type: z.literal('presence:watch'),
		user_id: z.string(),
	}),
	z.object({
		type: z.literal('presence:unwatch'),
		user_id: z.string(),
	}),
	// Keeps this connection's presence TTL alive — see presence.ts's
	// `PRESENCE_TTL_SECONDS` comment for why this exists (a connection that
	// dies without a clean close, e.g. the app getting killed, stops
	// sending these and the presence key simply expires instead of leaking
	// "online" forever).
	z.object({
		type: z.literal('presence:heartbeat'),
	}),
])

const conversationTopic = (id: number) => `conversation:${id}`
const userTopic = (userId: string) => `user:${userId}`
// Every presence change for a user is also published here regardless of
// conversation membership, so an explicit `presence:watch` (for a contact
// with no shared conversation yet) still gets live updates — `userTopic`
// alone only reaches people `contactsFor` already knows about.
const presenceTopic = (userId: string) => `presence:${userId}`

// Every DB-writing frame (send/edit) shares one process-wide bucket per
// user — same in-memory, single-instance posture as
// middlewares/rateLimitMiddleware.ts's REST limiter, just consumed
// directly instead of as Hono middleware since a WebSocket's `onMessage`
// has no `next()` to wrap. 20 writes per 10s is generous for a real
// conversation (bursts of a few messages in a row) while still stopping a
// scripted client from hammering Postgres for free.
const messageWriteLimiter = createRateLimiter({ windowMs: 10_000, max: 20 })

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
	const byConversation =
		await chatService.getParticipantIdsForConversations(conversationIds)
	const allParticipants = [...byConversation.values()].flat()
	return [...new Set(allParticipants.filter((id) => id !== excludingUserId))]
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

		// Which conversations this connection last announced itself as
		// typing/recording in, so onClose can announce a stop for each —
		// without this, a client that disconnects mid-typing (crash, lost
		// signal, app killed) leaves the other participant's "typing…"
		// indicator stuck on forever, since the only thing that would
		// otherwise clear it is a typing:stop frame this connection will now
		// never send.
		const typingIn = new Set<number>()
		const recordingIn = new Set<number>()

		return {
			async onOpen(_evt, ws) {
				const raw = ws.raw as ServerWebSocket<unknown>
				conversationIds = await getConversationIds(user.id)

				raw.subscribe(userTopic(user.id))
				for (const id of conversationIds) raw.subscribe(conversationTopic(id))

				// Catch-up delivery — anything sent to this user while they were
				// offline is, as of right now, actually on its way to their
				// client. Without this, a message that only ever got "sent"
				// (recipient wasn't online at send time) would stay stuck there
				// forever, even though the recipient has since read the whole
				// thread — see chatSchema's comment on `last_delivered_at` for why
				// this can't just be re-derived live from presence alone.
				// `fanoutBroadcast`, not `fanoutFromConnection`: there's no single
				// "triggering connection to exclude" here the way a reader/sender
				// action has — whoever sent the now-delivered messages needs this
				// regardless of which of their own devices is open.
				const deliveredAt = await chatService.markDeliveredForConversations(
					user.id,
					conversationIds,
				)
				for (const id of conversationIds) {
					fanoutBroadcast(
						conversationTopic(id),
						JSON.stringify({
							type: 'delivered',
							conversation_id: id,
							user_id: user.id,
							delivered_at: deliveredAt,
						}),
					)
				}

				const contacts = await contactsFor(conversationIds, user.id)

				// Tell this client who's already online immediately — presence
				// events only fire on state *changes*, so without this it would
				// have to wait for a contact's next connect/disconnect.
				ws.send(
					JSON.stringify({
						type: 'ready',
						online_user_ids: await getOnlineUserIds(contacts),
					}),
				)

				const justCameOnline = await registerConnection(user.id)
				if (justCameOnline) {
					const payload = JSON.stringify({
						type: 'presence',
						user_id: user.id,
						online: true,
					})
					for (const contactId of contacts)
						fanoutBroadcast(userTopic(contactId), payload)
					fanoutBroadcast(presenceTopic(user.id), payload)
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
							if (!messageWriteLimiter.consume(user.id)) {
								ws.send(
									JSON.stringify({
										type: 'error',
										error: 'Too many messages — slow down',
										client_id: parsed.client_id,
									}),
								)
								return
							}

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
								last_message_kind: message.kind,
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
							const onlineIds = await getOnlineUserIds(participantIds)
							const offlineRecipients = participantIds.filter(
								(id) => id !== user.id && !onlineIds.includes(id),
							)

							// Recipients online right now have this message on their own
							// open connection the instant it's fanned out above — persist
							// that as a real delivery, not just a live "they're connected"
							// presence check, so the tick doesn't revert to "sent" if they
							// go offline again before reconnecting (see chatSchema's
							// `last_delivered_at` comment). `fanoutBroadcast`, not
							// `fanoutFromConnection`: the sender (`raw`) is exactly who
							// needs this, not who should be excluded from it.
							const onlineRecipients = participantIds.filter(
								(id) => id !== user.id && onlineIds.includes(id),
							)
							for (const recipientId of onlineRecipients) {
								const deliveredAt = await chatService.markDelivered(
									conversationId,
									recipientId,
								)
								fanoutBroadcast(
									conversationTopic(conversationId),
									JSON.stringify({
										type: 'delivered',
										conversation_id: conversationId,
										user_id: recipientId,
										delivered_at: deliveredAt,
									}),
								)
							}
							// `preview` is blank for an image/voice message with no
							// caption (the conversation list renders its own icon +
							// localized "Photo"/"Voice" label for that case instead —
							// see Bazar56's ChatUserCard) — a push notification has no
							// such icon to fall back on, so it needs real fallback text.
							const notificationBody =
								preview ||
								(data.kind === 'image'
									? data.images.length > 1
										? `📷 ${data.images.length} photos`
										: '📷 Photo'
									: data.kind === 'voice'
										? '🎤 Voice message'
										: preview)
							notificationDispatchService
								.notifyUsers({
									type: 'new_message',
									recipients: offlineRecipients,
									actorId: user.id,
									messageId: message.id,
									data: {
										title: 'New Message',
										body: notificationBody,
										conversation_id: conversationId,
										actor_name: user.name,
									},
									push: { title: user.name, body: notificationBody },
								})
								.catch((err) =>
									console.error('[chat] failed to notify recipients:', err),
								)
							return
						}

						case 'message:edit': {
							if (!messageWriteLimiter.consume(user.id)) {
								ws.send(
									JSON.stringify({
										type: 'error',
										error: 'Too many messages — slow down',
									}),
								)
								return
							}

							const { message, participantIds, preview } =
								await chatService.editMessage(
									parsed.message_id,
									parsed.conversation_id,
									user.id,
									parsed.content,
								)

							const updatedPayload = JSON.stringify({
								type: 'message:updated',
								message,
							})
							fanoutFromConnection(
								raw,
								conversationTopic(parsed.conversation_id),
								updatedPayload,
							)
							ws.send(updatedPayload)

							// Only the conversation list needs a separate broadcast, and
							// only if this message was still the latest one.
							if (preview != null) {
								const previewPayload = JSON.stringify({
									type: 'conversation:updated',
									conversation_id: parsed.conversation_id,
									last_message_preview: preview,
									last_message_kind: message.kind,
									created_at: message.created_at,
								})
								for (const participantId of participantIds) {
									fanoutFromConnection(
										raw,
										userTopic(participantId),
										previewPayload,
									)
								}
							}
							return
						}

						case 'message:delete': {
							const { message, participantIds, preview } =
								await chatService.deleteMessage(
									parsed.message_id,
									parsed.conversation_id,
									user.id,
								)

							const updatedPayload = JSON.stringify({
								type: 'message:updated',
								message,
							})
							fanoutFromConnection(
								raw,
								conversationTopic(parsed.conversation_id),
								updatedPayload,
							)
							ws.send(updatedPayload)

							if (preview != null) {
								const previewPayload = JSON.stringify({
									type: 'conversation:updated',
									conversation_id: parsed.conversation_id,
									last_message_preview: preview,
									last_message_kind: message.kind,
									created_at: message.created_at,
								})
								for (const participantId of participantIds) {
									fanoutFromConnection(
										raw,
										userTopic(participantId),
										previewPayload,
									)
								}
							}
							return
						}

						case 'typing:start':
						case 'typing:stop': {
							const member = await chatService.isParticipant(
								parsed.conversation_id,
								user.id,
							)
							if (!member) return

							if (parsed.type === 'typing:start') {
								typingIn.add(parsed.conversation_id)
							} else {
								typingIn.delete(parsed.conversation_id)
							}

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

							if (parsed.type === 'recording:start') {
								recordingIn.add(parsed.conversation_id)
							} else {
								recordingIn.delete(parsed.conversation_id)
							}

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

						case 'presence:watch': {
							raw.subscribe(presenceTopic(parsed.user_id))
							const online = (
								await getOnlineUserIds([parsed.user_id])
							).includes(parsed.user_id)
							ws.send(
								JSON.stringify({
									type: 'presence',
									user_id: parsed.user_id,
									online,
								}),
							)
							return
						}

						case 'presence:unwatch': {
							raw.unsubscribe(presenceTopic(parsed.user_id))
							return
						}

						case 'presence:heartbeat': {
							await refreshConnection(user.id)
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
				// No `raw`/`ws` available anymore by the time onClose fires —
				// these go through fanoutBroadcast (server-wide publish), same as
				// the presence announcement below, not fanoutFromConnection.
				for (const conversationId of typingIn) {
					fanoutBroadcast(
						conversationTopic(conversationId),
						JSON.stringify({
							type: 'typing',
							conversation_id: conversationId,
							user_id: user.id,
							is_typing: false,
						}),
					)
				}
				for (const conversationId of recordingIn) {
					fanoutBroadcast(
						conversationTopic(conversationId),
						JSON.stringify({
							type: 'recording',
							conversation_id: conversationId,
							user_id: user.id,
							is_recording: false,
						}),
					)
				}

				const justWentOffline = await unregisterConnection(user.id)
				if (!justWentOffline) return

				const contacts = await contactsFor(conversationIds, user.id)
				const payload = JSON.stringify({
					type: 'presence',
					user_id: user.id,
					online: false,
				})
				for (const contactId of contacts)
					fanoutBroadcast(userTopic(contactId), payload)
				fanoutBroadcast(presenceTopic(user.id), payload)
			},
		}
	}),
)

export default router
