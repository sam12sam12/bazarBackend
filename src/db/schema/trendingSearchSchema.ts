import { sql } from 'drizzle-orm'
import {
	bigserial,
	boolean,
	index,
	integer,
	pgTable,
	varchar,
} from 'drizzle-orm/pg-core'
import { searchTargetEnum, timestamps } from './_shared'

// ==================== TRENDING SEARCHES ====================
// Manually curated by an admin (via seed data / Drizzle Studio) — never
// written to from real user search activity.
export const trendingSearches = pgTable(
	'trending_searches',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		target: searchTargetEnum('target').notNull(),
		term: varchar('term', { length: 100 }).notNull(),
		sort_order: integer('sort_order').default(0).notNull(),
		is_active: boolean('is_active').default(true).notNull(),

		...timestamps,
	},
	(table) => [
		index('trending_searches_active_idx')
			.on(table.target, table.sort_order, table.id)
			.where(sql`${table.is_active} = true`),
	],
)
