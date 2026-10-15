import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	varchar,
} from 'drizzle-orm/pg-core'
import {
	currencyEnum,
	listingStatusEnum,
	productConditionEnum,
	timestamps,
} from './_shared'
import { categories } from './categorySchema'
import { provinces } from './provinceSchema'
import { stores } from './storeSchema'

// ==================== PRODUCTS TABLE ====================
export const products = pgTable(
	'products',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),
		category_id: bigint('category_id', { mode: 'number' }).notNull(),
		province_id: bigint('province_id', { mode: 'number' }).notNull(),

		// ── Core info ──
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description').notNull(),

		// ── Pricing ── (no stock/quantity tracking — Afghan Bazar listings
		// are classifieds-style, not retail inventory; availability is just
		// `is_active`/`listing_status`, not a unit count.)
		price: numeric('price', { precision: 14, scale: 2 }).notNull(),
		compare_at_price: numeric('compare_at_price', { precision: 14, scale: 2 }),
		off_percentage: integer('off_percentage'),
		currency: currencyEnum('currency').default('AFN').notNull(),

		// ── Condition & Status ──
		condition: productConditionEnum('condition').default('new').notNull(),
		listing_status: listingStatusEnum('listing_status')
			.default('draft')
			.notNull(),
		is_active: boolean('is_active').default(true).notNull(),
		featured: boolean('featured').default(false).notNull(),
		is_negotiable: boolean('is_negotiable').default(false).notNull(),

		// ── Delivery & Location (critical for real estate & vehicles) ──
		delivery_available: boolean('delivery_available').default(false).notNull(),
		// Only meaningful when `delivery_available` is true — same-city vs.
		// other-province fee/timeframe, same split CreateProductScreen's
		// delivery step collects (see ProductDeliveryStep.tsx).
		intra_city_fee: numeric('intra_city_fee', { precision: 12, scale: 2 }),
		intra_city_days: varchar('intra_city_days', { length: 50 }),
		inter_province_fee: numeric('inter_province_fee', { precision: 12, scale: 2 }),
		inter_province_days: varchar('inter_province_days', { length: 50 }),
		latitude: numeric('latitude', { precision: 10, scale: 7 }),
		longitude: numeric('longitude', { precision: 10, scale: 7 }),
		is_global: boolean('is_global').default(false).notNull(),

		// ── Flexible specs for any category (real estate, vehicles, etc.) ──
		specifications: jsonb('specifications').default(sql`'{}'::jsonb`).notNull(),

		// ── Images directly in products ──
		// Format: [{ url: string, sort_order: number, is_primary: boolean }, ...]
		images: jsonb('images').default(sql`'[]'::jsonb`).notNull(),

		// ── Engagement counters ──
		view_count: integer('view_count').default(0).notNull(),
		favorite_count: integer('favorite_count').default(0).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'products_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.category_id],
			foreignColumns: [categories.id],
			name: 'products_category_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.province_id],
			foreignColumns: [provinces.id],
			name: 'products_province_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		index('products_active_pagination_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		index('products_store_pagination_idx')
			.on(table.store_id, table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		index('products_category_pagination_idx')
			.on(table.category_id, table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		index('products_province_pagination_idx')
			.on(table.province_id, table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		index('products_global_pagination_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true AND ${table.is_global} = true`),

		index('products_fts_idx').using(
			'gin',
			sql`to_tsvector('simple', coalesce(${table.title}, '') || ' ' || coalesce(${table.description}, ''))`,
		),

		index('products_specifications_gin_idx').using('gin', table.specifications),
		index('products_images_gin_idx').using('gin', table.images),

		index('products_location_gist_idx').using(
			'gist',
			sql`ll_to_earth(${table.latitude}, ${table.longitude})`,
		),
	],
)
