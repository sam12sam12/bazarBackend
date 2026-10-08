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

// ==================== STORE VIEWS ====================
export const storeViews = pgTable(
	'store_views',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),

		viewed_at: timestamp('viewed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'store_views_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'store_views_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List a user's most recently viewed stores
		index('store_views_user_idx').on(table.user_id, table.viewed_at.desc()),

		// One row per user/store — re-viewing bumps viewed_at instead of duplicating
		uniqueIndex('store_views_user_store_unique').on(
			table.user_id,
			table.store_id,
		),
	],
)
