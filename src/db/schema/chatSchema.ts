import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'
import { timestamps } from './_shared'
import { users } from './userSchema'

export const MESSAGE_KINDS = ['text', 'image', 'voice'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

// One row per 1:1 chat. `direct_key` is a canonical, order-independent key
// derived from the two participants' ids (smaller-uuid:larger-uuid) — the
// partial unique index on it is what makes "find or create this
// conversation" an atomic `ON CONFLICT DO NOTHING` in chatService, instead
// of a check-then-insert race.
export const conversations = pgTable(
	'conversations',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		direct_key: text('direct_key'),

		last_message_at: timestamp('last_message_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		// Denormalized onto the conversation row so the list screen never has
		// to join into `messages` just to render a preview — kept in sync by
		// chatService.sendMessage in the same insert as the new message.
		last_message_preview: text('last_message_preview').notNull().default(''),
		last_message_sender_id: uuid('last_message_sender_id').notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.last_message_sender_id],
			foreignColumns: [users.id],
			name: 'conversations_last_message_sender_id_fkey',
		}).onDelete('cascade'),

		uniqueIndex('conversations_direct_key_key')
			.on(table.direct_key)
			.where(sql`${table.direct_key} is not null`),

		index('conversations_last_message_at_id_idx').on(
			table.last_message_at.desc(),
			table.id.desc(),
		),

		check(
			'conversations_preview_length_valid',
			sql`char_length(${table.last_message_preview}) <= 200`,
		),
	],
)

export const conversation_participants = pgTable(
	'conversation_participants',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		conversation_id: bigint('conversation_id', { mode: 'number' }).notNull(),
		user_id: uuid('user_id').notNull(),
		last_read_at: timestamp('last_read_at', { withTimezone: true }),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.conversation_id],
			foreignColumns: [conversations.id],
			name: 'conversation_participants_conversation_id_fkey',
		}).onDelete('cascade'),

		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'conversation_participants_user_id_fkey',
		}).onDelete('cascade'),

		uniqueIndex('conversation_participants_conversation_user_key').on(
			table.conversation_id,
			table.user_id,
		),
		index('conversation_participants_user_id_idx').on(table.user_id),
	],
)

export const messages = pgTable(
	'messages',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		conversation_id: bigint('conversation_id', { mode: 'number' }).notNull(),
		sender_id: uuid('sender_id').notNull(),

		// No pgEnum here on purpose — the codebase's other domain vocab (role,
		// order_status, etc.) is genuinely fixed, but a message's `kind` gates
		// which of content/images/audio_url is populated, which the CHECK
		// constraints below already enforce at the DB level; a `text` column
		// keeps that enforcement in one place instead of splitting it between
		// an enum type and these CHECKs.
		kind: text('kind').notNull().default('text'),
		content: text('content'),
		images: text('images').array(),
		audio_url: text('audio_url'),
		audio_duration_seconds: bigint('audio_duration_seconds', {
			mode: 'number',
		}),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.conversation_id],
			foreignColumns: [conversations.id],
			name: 'messages_conversation_id_fkey',
		}).onDelete('cascade'),

		foreignKey({
			columns: [table.sender_id],
			foreignColumns: [users.id],
			name: 'messages_sender_id_fkey',
		}).onDelete('cascade'),

		index('messages_conversation_pagination_idx').on(
			table.conversation_id,
			table.created_at.desc(),
			table.id.desc(),
		),
		index('messages_sender_id_idx').on(table.sender_id),

		check(
			'messages_kind_valid',
			sql`${table.kind} in ('text', 'image', 'voice')`,
		),
		check(
			'messages_text_content_valid',
			sql`${table.kind} <> 'text' or (${table.content} is not null and char_length(${table.content}) > 0)`,
		),
		check(
			'messages_image_content_valid',
			sql`${table.kind} <> 'image' or (${table.images} is not null and array_length(${table.images}, 1) > 0)`,
		),
		check(
			'messages_voice_content_valid',
			sql`${table.kind} <> 'voice' or ${table.audio_url} is not null`,
		),
	],
)
