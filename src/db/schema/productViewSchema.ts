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

import { products } from './productSchema'
import { users } from './userSchema'

// ==================== PRODUCT VIEWS ====================
export const productViews = pgTable(
	'product_views',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		product_id: bigint('product_id', { mode: 'number' }).notNull(),

		viewed_at: timestamp('viewed_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'product_views_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'product_views_product_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List a user's most recently viewed products
		index('product_views_user_idx').on(table.user_id, table.viewed_at.desc()),

		// One row per user/product — re-viewing bumps viewed_at instead of duplicating
		uniqueIndex('product_views_user_product_unique').on(
			table.user_id,
			table.product_id,
		),
	],
)
