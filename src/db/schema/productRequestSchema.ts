import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	jsonb,
	numeric,
	pgTable,
	text,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { currencyEnum, productRequestStatusEnum, timestamps } from './_shared'
import { categories } from './categorySchema'
import { provinces } from './provinceSchema'
import { users } from './userSchema'

// ==================== PRODUCT REQUESTS ("wanted ads") ====================
// A buyer posts a product they want but can't find. Everyone can browse open
// requests; the owner (or an admin) can resolve or close them.
export const productRequests = pgTable(
	'product_requests',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		category_id: bigint('category_id', { mode: 'number' }).notNull(),
		province_id: bigint('province_id', { mode: 'number' }),

		// ── Core info ──
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description').notNull(),

		// ── Budget range ──
		budget_min: numeric('budget_min', { precision: 14, scale: 2 }),
		budget_max: numeric('budget_max', { precision: 14, scale: 2 }),
		currency: currencyEnum('currency').default('AFN').notNull(),

		// ── Reference images (same shape as products) ──
		// Format: [{ url: string, sort_order: number, is_primary: boolean }, ...]
		images: jsonb('images').default(sql`'[]'::jsonb`).notNull(),

		// ── Lifecycle ──
		status: productRequestStatusEnum('status').default('open').notNull(),
		is_urgent: boolean('is_urgent').default(false).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'product_requests_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.category_id],
			foreignColumns: [categories.id],
			name: 'product_requests_category_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.province_id],
			foreignColumns: [provinces.id],
			name: 'product_requests_province_id_fkey',
		})
			.onDelete('set null')
			.onUpdate('cascade'),

		// Public browse — open requests, newest first
		index('product_requests_open_pagination_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.status} = 'open'`),

		// "My requests" lookup
		index('product_requests_user_pagination_idx').on(
			table.user_id,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Sellers browsing open requests in their category
		index('product_requests_category_pagination_idx')
			.on(table.category_id, table.created_at.desc(), table.id.desc())
			.where(sql`${table.status} = 'open'`),
	],
)
