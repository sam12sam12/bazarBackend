import { and, eq, isNull, ne, or } from 'drizzle-orm'
import { db } from '../db/db'
import { pushTokens } from '../db/schema'
import type { InsertPushToken } from '../db/validation'

export const pushTokenService = {
	// Single-row-per-user upsert — "latest device/login wins". The token
	// column also carries a unique index: if the same physical token already
	// has a row under a *different* identity — another account, or (the
	// common case) the anonymous row created before this user signed in on
	// this device — drop that row first so the user_id upsert below can't
	// collide with it. This is also how an anonymous device gets "claimed":
	// signing in re-registers the same Expo token, which lands here.
	async upsert(userId: string, data: InsertPushToken) {
		await db
			.delete(pushTokens)
			.where(
				and(
					eq(pushTokens.token, data.token),
					or(isNull(pushTokens.user_id), ne(pushTokens.user_id, userId)),
				),
			)

		await db
			.insert(pushTokens)
			.values({ user_id: userId, ...data, last_used_at: new Date() })
			.onConflictDoUpdate({
				target: pushTokens.user_id,
				set: {
					token: data.token,
					platform: data.platform,
					device_name: data.device_name,
					os_version: data.os_version,
					last_used_at: new Date(),
				},
			})
	},

	async remove(userId: string) {
		await db.delete(pushTokens).where(eq(pushTokens.user_id, userId))
	},

	// Anonymous (not-signed-in) registration — keyed by the token itself
	// rather than a user_id, since there isn't one yet. If this token
	// already belongs to a signed-in user (e.g. the lifecycle hook fires
	// anonymously again before the session is known), leave user_id alone —
	// only the device metadata is refreshed.
	async upsertAnonymous(data: InsertPushToken) {
		await db
			.insert(pushTokens)
			.values({ user_id: null, ...data, last_used_at: new Date() })
			.onConflictDoUpdate({
				target: pushTokens.token,
				set: {
					platform: data.platform,
					device_name: data.device_name,
					os_version: data.os_version,
					last_used_at: new Date(),
				},
			})
	},
}
