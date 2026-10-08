import { eq } from 'drizzle-orm'
import { db } from '../db/db'
import { notificationPreferences } from '../db/schema'
import type { UpdateNotificationPreference } from '../db/validation'

export const notificationPreferenceService = {
	// A missing row means "all categories on" (every column defaults to
	// true) — create it lazily on first read rather than backfilling every
	// user up front.
	async getOrCreate(userId: string) {
		const existing = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.user_id, userId),
		})
		if (existing) return existing

		await db
			.insert(notificationPreferences)
			.values({ user_id: userId })
			.onConflictDoNothing()

		return db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.user_id, userId),
		})
	},

	async update(userId: string, patch: UpdateNotificationPreference) {
		await db
			.insert(notificationPreferences)
			.values({ user_id: userId, ...patch })
			.onConflictDoUpdate({
				target: notificationPreferences.user_id,
				set: patch,
			})

		return db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.user_id, userId),
		})
	},
}
