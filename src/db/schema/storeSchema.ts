import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	doublePrecision,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { approvalStatusEnum, ltree, timestamps } from './_shared'
import { categories } from './categorySchema'
import { provinces } from './provinceSchema'
import { users } from './userSchema'

// ==================== STORES ====================
export const stores = pgTable(
	'stores',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		name: varchar('name', { length: 150 }).notNull(),
		owner_id: uuid('owner_id').notNull(),

		category_id: bigint('category_id', { mode: 'number' }).notNull(),
		path: ltree('path').notNull(),

		description: text('description'),
		is_active: boolean('is_active').default(true).notNull(),

		// Whether this store delivers at all — gates whether any of its own
		// products can turn on their own per-listing delivery step/fees (see
		// productSchema's delivery_available/intra_city_fee/...).
		delivery_available: boolean('delivery_available').default(false).notNull(),

		// ── Location (Afghanistan optimized) ──
		address: text('address'),
		province_id: bigint('province_id', { mode: 'number' }).notNull(),
		latitude: doublePrecision('latitude'),
		longitude: doublePrecision('longitude'),

		logo_url: text('logo_url'),
		banner_url: text('banner_url'),
		contact_phone: varchar('contact_phone', { length: 20 }),
		secondary_phone: varchar('secondary_phone', { length: 20 }),
		whatsapp: varchar('whatsapp', { length: 20 }),
		contact_email: varchar('contact_email', { length: 255 }),

		// ── Approval & performance ──
		approval_status: approvalStatusEnum('approval_status')
			.default('pending')
			.notNull(),
		approved_at: timestamp('approved_at', { withTimezone: true }),

		product_count: integer('product_count').default(0).notNull(),

		featured: boolean('featured').default(false).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.owner_id!],
			foreignColumns: [users.id],
			name: 'stores_owner_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.category_id!],
			foreignColumns: [categories.id],
			name: 'stores_category_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.province_id!],
			foreignColumns: [provinces.id],
			name: 'stores_province_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		// Active stores pagination
		index('stores_active_pagination_idx')
			.on(table.created_at!.desc(), table.id!.desc())
			.where(sql`${table.is_active} = true`),

		// Category pagination
		index('stores_category_pagination_idx')
			.on(table.category_id!, table.created_at!.desc(), table.id!.desc())
			.where(sql`${table.is_active} = true`),

		// Province pagination
		index('stores_province_pagination_idx')
			.on(table.province_id!, table.created_at!.desc(), table.id!.desc())
			.where(sql`${table.is_active} = true`),

		// Owner lookup
		index('stores_owner_pagination_idx')
			.on(table.owner_id!, table.created_at!.desc(), table.id!.desc())
			.where(sql`${table.is_active} = true`),

		// Name search for suggestions
		index('stores_name_fts_idx').using(
			'gin',
			sql`to_tsvector('simple', coalesce(${table.name}, ''))`,
		),

		// Tree operations
		index('stores_path_gist_idx').using('gist', table.path!),

		// Geolocation
		index('stores_location_idx').using(
			'gist',
			sql`ll_to_earth(${table.latitude}, ${table.longitude})`,
		),
	],
)
