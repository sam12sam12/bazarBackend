import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	unique,
	varchar,
} from 'drizzle-orm/pg-core'
import { ltree, timestamps } from './_shared'

// ==================== CATEGORY NAME (i18n) ====================
export type CategoryName = {
	en: string
	ps: string
	fa: string
}

// ==================== CATEGORIES ====================
export const categories = pgTable(
	'categories',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		name: jsonb('name').$type<CategoryName>().notNull(),

		parent_id: bigint('parent_id', { mode: 'number' }),
		path: ltree('path').notNull(),
		depth: integer('depth').notNull().default(0),

		is_active: boolean('is_active').default(true).notNull(),
		sort_order: integer('sort_order').default(0),

		icon_url: text('icon_url'),
		delivery: boolean('delivery').default(false).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.parent_id],
			foreignColumns: [table.id],
			name: 'categories_parent_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		// REQUIRED (do not remove)
		index('categories_path_gist_idx').using('gist', table.path),
	],
)

export const categoryAttribute = pgTable(
	'category_attribute',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		category_id: bigint('category_id', { mode: 'number' }).notNull(),

		code: varchar('code', { length: 80 }).notNull(),
		label: varchar('label', { length: 150 }).notNull(),
		type: varchar('type', { length: 30 }).notNull(),

		options: jsonb('options'),
		sort_order: integer('sort_order').default(0).notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.category_id],
			foreignColumns: [categories.id],
			name: 'category_attribute_category_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),
		unique('category_attribute_unique').on(table.category_id, table.code),
	],
)
