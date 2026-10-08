import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	jsonb,
	pgTable,
	uuid,
} from 'drizzle-orm/pg-core'
import { notificationTypeEnum, timestamps } from './_shared'
import { products } from './productSchema'
import { users } from './userSchema'

export const notifications = pgTable(
	'notifications',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),

		// Who triggered the notification (the follower, the bidder, the reviewer…)
		actor_id: uuid('actor_id').notNull(),

		type: notificationTypeEnum('type').notNull(),

		// Optional direct links (for fast deep-linking in mobile)
		product_id: bigint('product_id', { mode: 'number' }),
		message_id: bigint('message_id', { mode: 'number' }),

		// Rich, type-specific payload (title, subtitle, image, deep-link data, price info…)
		data: jsonb('data').notNull().default(sql`'{}'::jsonb`),

		is_read: boolean('is_read').notNull().default(false),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'notifications_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.actor_id],
			foreignColumns: [users.id],
			name: 'notifications_actor_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'notifications_product_id_fkey',
		})
			.onDelete('set null')
			.onUpdate('cascade'),

		// User notifications pagination
		index('notifications_user_pagination_idx').on(
			table.user_id,
			table.created_at.desc(),
			table.id.desc(),
		),

		// Unread count and mark all as read
		index('notifications_unread_count_idx')
			.on(table.user_id)
			.where(sql`${table.is_read} = false`),
	],
)
