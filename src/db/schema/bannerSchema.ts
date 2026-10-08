import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	varchar,
} from 'drizzle-orm/pg-core'
import { bannerTypeEnum, timestamps } from './_shared'
import { categories } from './categorySchema'
import { products } from './productSchema'
import { provinces } from './provinceSchema'
import { stores } from './storeSchema'

// ==================== BANNERS ====================
export const banners = pgTable(
	'banners',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		title: varchar('title', { length: 150 }).notNull(),
		description: text('description'),
		image_url: text('image_url').notNull(),
		product_id: bigint('product_id', { mode: 'number' }),
		category_id: bigint('category_id', { mode: 'number' }),
		store_id: bigint('store_id', { mode: 'number' }),
		type: bannerTypeEnum('type').notNull(),
		link: text('link'),

		// ── Province-based sponsorship (country OR single province) ──
		is_global: boolean('is_global').default(false).notNull(), // true = show in ALL provinces
		province_id: bigint('province_id', { mode: 'number' }), // null = global only, otherwise specific province

		sort_order: integer('sort_order').default(0).notNull(),
		is_active: boolean('is_active').default(true).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'banners_product_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.category_id],
			foreignColumns: [categories.id],
			name: 'banners_category_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'banners_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.province_id],
			foreignColumns: [provinces.id],
			name: 'banners_province_id_fkey',
		})
			.onDelete('set null')
			.onUpdate('cascade'),

		index('banners_active_pagination_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		index('banners_active_global_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true AND ${table.is_global} = true`),

		index('banners_active_province_idx')
			.on(table.province_id, table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true AND ${table.is_global} = false`),

		index('banners_active_sort_idx')
			.on(table.sort_order.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),
	],
)
