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

import { stores } from './storeSchema'
import { users } from './userSchema'

// ==================== STORE FOLLOWS ====================
export const storeFollows = pgTable(
	'store_follows',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),

		followed_at: timestamp('followed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'store_follows_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'store_follows_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List all stores a user follows
		index('store_follows_user_idx').on(table.user_id, table.followed_at),

		// List all followers of a store
		index('store_follows_store_idx').on(table.store_id, table.followed_at),

		// Prevent duplicate follows
		uniqueIndex('store_follows_user_store_unique').on(
			table.user_id,
			table.store_id,
		),
	],
)
