import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './userSchema'

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		created_at: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: timestamp('updated_at', { withTimezone: true })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ip_address: text('ip_address'),
		user_agent: text('user_agent'),
		user_id: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
	},
	(table) => [index('session_userId_idx').on(table.user_id)],
)

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		account_id: text('account_id').notNull(),
		provider_id: text('provider_id').notNull(),
		user_id: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
			withTimezone: true,
		}),
		scope: text('scope'),
		password: text('password'),
		created_at: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: timestamp('updated_at', { withTimezone: true })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('account_userId_idx').on(table.user_id)],
)

// Better Auth core model — required even for social-only auth. Stays empty in
// this app (no email verification / password reset / magic-link flows).
export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
		created_at: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updated_at: timestamp('updated_at', { withTimezone: true })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)],
)
