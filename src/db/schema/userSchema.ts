import { sql } from 'drizzle-orm'
import {
	bigint,
	boolean,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { roleEnum, timestamps } from './_shared'
import { provinces } from './provinceSchema'

// ==================== USERS ====================
export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: varchar('name', { length: 100 }).notNull(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		phone: varchar('phone', { length: 20 }),
		avatar_url: text('avatar_url'),
		province_id: bigint('province_id', { mode: 'number' }),

		role: roleEnum('role').default('buyer').notNull(),
		is_active: boolean('is_active').default(true).notNull(),
		email_verified: boolean('email_verified').default(false).notNull(),
		last_login: timestamp('last_login', { withTimezone: true }),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.province_id],
			foreignColumns: [provinces.id],
			name: 'users_province_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		// indexes -------------------------
		index('users_province_id_idx').on(table.province_id),
		index('users_active_created_at_id_idx')
			.on(table.created_at.desc(), table.id.desc())
			.where(sql`${table.is_active} = true`),

		// Hybrid tsvector+trigram search (chatService's `buildFuzzySearch`,
		// via `userFuzzySearchTarget`) — same shape as `stores_name_fts_idx`/
		// `stores_name_trgm_idx`, just this entity's single `name` column
		// (no description to concatenate in). Backs conversation search:
		// "find the conversation with this contact by name."
		index('users_name_fts_idx').using(
			'gin',
			sql`to_tsvector('simple', coalesce(${table.name}, ''))`,
		),

		// Trigram index backing `lower(name) % lower(search)` — the
		// typo-tolerant half; needs `pg_trgm` already enabled on this
		// database (see storeSchema.ts's identical note — products/stores
		// already depend on it, so it's already there).
		index('users_name_trgm_idx').using(
			'gin',
			sql`lower(${table.name}) gin_trgm_ops`,
		),
	],
)
