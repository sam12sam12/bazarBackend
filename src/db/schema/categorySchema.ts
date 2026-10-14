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

// One selectable value inside a `type: "menu"` attribute (e.g. one of
// RAM's "4GB"/"8GB"/"16GB" choices) — `value` is the machine-stable key
// stored on a product's `specifications`, `label` is what's shown per
// locale.
export type CategoryAttributeOption = {
	value: string
	label: CategoryName
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
		// Curated Home-rail pick — independent of depth, so a specific leaf
		// (e.g. "Mobiles") can show up there without its whole department
		// ("Electronics") needing to, and without the rail just defaulting
		// to "every root department" the way it does today.
		is_popular: boolean('is_popular').default(false).notNull(),

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
		// Translated, same shape as `categories.name` — was a plain
		// untranslated varchar.
		label: jsonb('label').$type<CategoryName>().notNull(),
		// Exactly three canonical values going forward: "menu" (translated
		// select, `menu_data` required), "number" (free numeric input),
		// "text" (free text input) — the old seed data mixed "dropdown"/
		// "select" inconsistently for the same thing.
		type: varchar('type', { length: 30 }).notNull(),

		// Only meaningful for `type: "menu"` — e.g. "Select RAM" / "رام غوره
		// کړئ". Not used by "number"/"text" inputs.
		placeholder: jsonb('placeholder').$type<CategoryName>(),
		// Renamed from `options` — was an untyped flat array (plain strings/
		// numbers, no translation). Now a translated `{value, label}[]`, only
		// populated for `type: "menu"`.
		menu_data: jsonb('menu_data').$type<CategoryAttributeOption[]>(),
		// Only meaningful for `type: "menu"` — lets the seller pick more than
		// one value (e.g. a listing offered in several RAM/Storage/Color
		// variants). False for single-fact attributes like Brand/Condition,
		// where exactly one value ever makes sense.
		multiple: boolean('multiple').default(false).notNull(),
		// Whether a listing under this category must answer this attribute —
		// the create-product wizard blocks advancing past the specs step
		// until every `required` attribute has a value (see ProductSpecsStep).
		required: boolean('required').default(true).notNull(),
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
