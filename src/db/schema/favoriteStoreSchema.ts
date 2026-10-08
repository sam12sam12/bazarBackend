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

// ==================== FAVORITE STORES ====================
export const favoriteStores = pgTable(
	'favorite_stores',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),

		favorited_at: timestamp('favorited_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'favorite_stores_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'favorite_stores_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List a user's saved stores, newest-first
		index('favorite_stores_user_idx').on(
			table.user_id,
			table.favorited_at.desc(),
		),

		// One save per user/store
		uniqueIndex('favorite_stores_user_store_unique').on(
			table.user_id,
			table.store_id,
		),
	],
)
