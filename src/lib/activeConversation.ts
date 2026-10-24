// Cluster-wide "which conversation is this user currently looking at"
// tracker — an overlay purely for message:send's notification gating (skip
// notifying someone who's staring right at the conversation the message
// just landed in), nothing load-bearing depends on it. Same shape as
// presence.ts on purpose: Redis-backed (works across devices and backend
// instances, not just this process), TTL self-healing (an app killed
// mid-chat — not cleanly backgrounded/closed — stops heartbeating and the
// key just expires instead of leaking "still viewing" forever), fails soft
// on a Redis outage (never blocks a send; worst case is an extra
// notification someone didn't strictly need).
//
// One key per *user*, not per connection — if someone has two devices open
// on two different conversations at once, whichever joined most recently
// wins. Same "latest wins" simplification this codebase already makes for
// push tokens (see pushTokenService.upsert) — not worth the complexity of
// per-connection state for a notification-suppression nicety.
import { publisher } from './redis'

const activeConversationKey = (userId: string) =>
	`active-conversation:${userId}`

// Same TTL as presence.ts's PRESENCE_TTL_SECONDS, refreshed by the exact
// same `presence:heartbeat` frame — both expire together on a connection
// that dies without a clean close.
const ACTIVE_CONVERSATION_TTL_SECONDS = 45

let loggedRedisFailure = false
function logRedisFailureOnce(context: string, error: unknown) {
	if (loggedRedisFailure) return
	loggedRedisFailure = true
	console.error(
		`activeConversation: Redis unavailable, disabled until it recovers (first failure in ${context}):`,
		error,
	)
}

export async function setActiveConversation(
	userId: string,
	conversationId: number,
): Promise<void> {
	try {
		await publisher.set(
			activeConversationKey(userId),
			String(conversationId),
			'EX',
			ACTIVE_CONVERSATION_TTL_SECONDS,
		)
		loggedRedisFailure = false
	} catch (error) {
		logRedisFailureOnce('setActiveConversation', error)
	}
}

// Only clears if the key still holds *this* conversation id — guards
// against a stale `leave`/disconnect from one device wiping out a value a
// different device just set for the same user (see the "latest wins"
// comment above).
export async function clearActiveConversation(
	userId: string,
	conversationId: number,
): Promise<void> {
	try {
		const current = await publisher.get(activeConversationKey(userId))
		if (current === String(conversationId)) {
			await publisher.del(activeConversationKey(userId))
		}
		loggedRedisFailure = false
	} catch (error) {
		logRedisFailureOnce('clearActiveConversation', error)
	}
}

export async function refreshActiveConversation(userId: string): Promise<void> {
	try {
		await publisher.expire(
			activeConversationKey(userId),
			ACTIVE_CONVERSATION_TTL_SECONDS,
		)
		loggedRedisFailure = false
	} catch (error) {
		logRedisFailureOnce('refreshActiveConversation', error)
	}
}

// Batched (MGET), matching presence.ts's getOnlineUserIds — message:send
// needs "which of these participants currently have conversation X open,"
// not one lookup per recipient. Returns `null` for a user with no active
// conversation (or when Redis is down, for all of them).
export async function getActiveConversations(
	userIds: string[],
): Promise<Record<string, number | null>> {
	const result: Record<string, number | null> = {}
	if (userIds.length === 0) return result
	try {
		const values = await publisher.mget(userIds.map(activeConversationKey))
		loggedRedisFailure = false
		userIds.forEach((id, i) => {
			const v = values[i]
			result[id] = v != null ? Number(v) : null
		})
	} catch (error) {
		logRedisFailureOnce('getActiveConversations', error)
		for (const id of userIds) result[id] = null
	}
	return result
}
