import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	numeric,
	pgTable,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'
import { addressTypeEnum, timestamps } from './_shared'
import { provinces } from './provinceSchema'
import { users } from './userSchema'

// ==================== ADDRESSES ====================
export const addresses = pgTable(
	'addresses',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		province_id: bigint('province_id', { mode: 'number' }).notNull(),

		district: varchar('district', { length: 150 }),
		address_line: text('address_line').notNull(),

		recipient_name: varchar('recipient_name', { length: 150 }).notNull(),
		phone: varchar('phone', { length: 20 }).notNull(),
		label: varchar('label', { length: 100 }),
		type: addressTypeEnum('type').default('home').notNull(),

		is_default: boolean('is_default').default(false).notNull(),

		latitude: numeric('latitude', { precision: 10, scale: 7 }),
		longitude: numeric('longitude', { precision: 10, scale: 7 }),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'addresses_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.province_id],
			foreignColumns: [provinces.id],
			name: 'addresses_province_id_fkey',
		})
			.onDelete('restrict')
			.onUpdate('cascade'),

		// composite (user_id, created_at, id) already covers single user_id lookups
		index('addresses_user_pagination_idx').on(
			table.user_id,
			table.created_at.desc(),
			table.id.desc(),
		),
		index('addresses_province_id_idx').on(table.province_id),
		uniqueIndex('addresses_one_default_per_user')
			.on(table.user_id)
			.where(sql`${table.is_default} = true`),
	],
)

// ==================== FUTURE INSTRUCTIONS ====================
// if you ever do => WHERE province_id = ? ORDER BY created_at DESC, then change the province id index to =>

// index('addresses_province_created_at_idx').on(
//   table.province_id,
//   table.created_at.desc(),
// )
