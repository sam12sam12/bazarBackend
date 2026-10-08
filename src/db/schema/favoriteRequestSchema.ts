import {
	bigint,
	bigserial,
	foreignKey,
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

import { productRequests } from './productRequestSchema'
import { users } from './userSchema'

// ==================== FAVORITE PRODUCT REQUESTS ====================
export const favoriteRequests = pgTable(
	'favorite_requests',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		request_id: bigint('request_id', { mode: 'number' }).notNull(),

		favorited_at: timestamp('favorited_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'favorite_requests_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.request_id],
			foreignColumns: [productRequests.id],
			name: 'favorite_requests_request_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List a user's saved requests, newest-first
		index('favorite_requests_user_idx').on(
			table.user_id,
			table.favorited_at.desc(),
		),

		// One save per user/request
		uniqueIndex('favorite_requests_user_request_unique').on(
			table.user_id,
			table.request_id,
		),
	],
)
