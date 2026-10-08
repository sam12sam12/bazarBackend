import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	check,
	foreignKey,
	index,
	pgTable,
	text,
	uuid,
} from 'drizzle-orm/pg-core'
import {
	reportReasonEnum,
	reportStatusEnum,
	reportTypeEnum,
	timestamps,
} from './_shared'
import { productRequests } from './productRequestSchema'
import { products } from './productSchema'
import { stores } from './storeSchema'
import { users } from './userSchema'

// ==================== UNIFIED REPORTS ====================
export const reports = pgTable(
	'reports',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),

		// Entity being reported (exactly one of these must be present)
		product_id: bigint('product_id', { mode: 'number' }),
		store_id: bigint('store_id', { mode: 'number' }),
		request_id: bigint('request_id', { mode: 'number' }),
		reported_user_id: uuid('reported_user_id'),

		type: reportTypeEnum('type').notNull(),
		reason: reportReasonEnum('reason').notNull(),
		description: text('description'),

		status: reportStatusEnum('status').default('pending').notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'reports_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'reports_reports_product_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'reports_reports_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.request_id],
			foreignColumns: [productRequests.id],
			name: 'reports_reports_request_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.reported_user_id],
			foreignColumns: [users.id],
			name: 'reports_reported_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// Ensure exactly one entity is reported, matching `type`
		check(
			'reports_entity_check',
			sql`(type = 'product' AND product_id IS NOT NULL AND store_id IS NULL AND request_id IS NULL AND reported_user_id IS NULL) OR (type = 'store' AND product_id IS NULL AND store_id IS NOT NULL AND request_id IS NULL AND reported_user_id IS NULL) OR (type = 'request' AND product_id IS NULL AND store_id IS NULL AND request_id IS NOT NULL AND reported_user_id IS NULL) OR (type = 'user' AND product_id IS NULL AND store_id IS NULL AND request_id IS NULL AND reported_user_id IS NOT NULL)`,
		),

		// User reports lookup
		index('reports_user_pagination_idx').on(
			table.user_id,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Admin type filter & global sorting
		index('reports_type_created_idx').on(table.type, table.created_at.desc()),
	],
)
