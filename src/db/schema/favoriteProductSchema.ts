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

// ==================== FAVORITE PRODUCTS ====================
export const favoriteProducts = pgTable(
	'favorite_products',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),

		user_id: uuid('user_id').notNull(),
		product_id: bigint('product_id', { mode: 'number' }).notNull(),

		favorited_at: timestamp('favorited_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'favorite_products_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'favorite_products_product_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// List a user's saved products, newest-first
		index('favorite_products_user_idx').on(
			table.user_id,
			table.favorited_at.desc(),
		),

		// One save per user/product
		uniqueIndex('favorite_products_user_product_unique').on(
			table.user_id,
			table.product_id,
		),
	],
)
