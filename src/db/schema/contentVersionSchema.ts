import { integer, pgTable, smallint } from 'drizzle-orm/pg-core'

/**
 * Single-row table holding one monotonic integer, bumped whenever an admin
 * creates/updates/deletes a category, category attribute, or province.
 * Mobile clients probe this cheaply on launch and only refetch categories/
 * provinces when it differs from what they cached.
 */
export const contentVersion = pgTable('content_version', {
	id: smallint('id').primaryKey().default(1),
	version: integer('version').notNull().default(1),
})
