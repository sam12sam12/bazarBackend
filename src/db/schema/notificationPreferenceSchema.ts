import { boolean, foreignKey, pgTable, uuid } from 'drizzle-orm/pg-core'
import { timestamps } from './_shared'
import { users } from './userSchema'

// ==================== NOTIFICATION PREFERENCES ====================
// One row per user, created lazily on first read/write. A missing row
// means "all categories on" — every column defaults to true so a user
// who predates a new category keeps getting notified for it.
// admin_broadcast is intentionally not a column here: broadcasts are
// always delivered and are not user-mutable.
export const notificationPreferences = pgTable(
	'notification_preferences',
	{
		user_id: uuid('user_id').primaryKey(),

		new_store_product: boolean('new_store_product').default(true).notNull(),
		new_message: boolean('new_message').default(true).notNull(),
		order_status_changed: boolean('order_status_changed')
			.default(true)
			.notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'notification_preferences_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),
	],
)
