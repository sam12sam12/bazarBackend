import {
	bigserial,
	foreignKey,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'
import { pushPlatformEnum, timestamps } from './_shared'
import { users } from './userSchema'

// ==================== PUSH TOKENS ====================
// One row per user — the latest registered device/login overwrites the
// previous token (see pushTokenService.upsert, which targets the
// push_tokens_user_id_unique index via onConflictDoUpdate).
export const pushTokens = pgTable(
	'push_tokens',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		// Nullable: an anonymous (not-signed-in) device registers with no
		// user_id. It gets claimed by a user_id the moment that device signs
		// in and re-registers the same token (see pushTokenService.upsert).
		user_id: uuid('user_id'),

		token: text('token').notNull(),
		platform: pushPlatformEnum('platform').notNull(),
		device_name: text('device_name'),
		os_version: text('os_version'),

		last_used_at: timestamp('last_used_at', { withTimezone: true })
			.defaultNow()
			.notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'push_tokens_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		uniqueIndex('push_tokens_user_id_unique').on(table.user_id),
		uniqueIndex('push_tokens_token_unique').on(table.token),
	],
)
