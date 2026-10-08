import { sql } from "drizzle-orm";
import { bigint, bigserial, check, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./userSchema";

// No pgEnum (see Drizzle skill's "avoid DB enums" rule) — a `text` column +
// CHECK is cheaper to evolve if a fourth kind is ever added.
export type MessageKind = "text" | "image" | "voice";
export const MESSAGE_KINDS = ["text", "image", "voice"] as const;

// One row per conversation. Deliberately not "1:1 only" at the schema
// level — `conversation_participants` is a proper join table, not two fixed
// FK columns on this table — so a future group chat is an additive change,
// not a schema rewrite.
//
// A conversation is only ever created as part of inserting its first
// message (see chatService.sendMessage) — there's no "start an empty
// conversation" path — so `last_message_at`/`last_message_preview` are
// always set at row-creation time and stay `NOT NULL` forever after,
// instead of needing `NULLS LAST` handling for a state (zero messages)
// that can't actually occur.
export const conversations = pgTable(
  "conversations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // `[userA, userB].sort().join(':')` — set only for 1:1 conversations,
    // left `NULL` for a future group conversation (no natural pair key to
    // dedupe against). This is what makes "find or create the conversation
    // between these two users" a single atomic `INSERT ... ON CONFLICT DO
    // NOTHING` (see chatService.sendMessage) instead of a
    // check-then-insert race — two people messaging each other for the
    // first time at the same instant must not create two conversations.
    direct_key: text("direct_key"),

    last_message_at: timestamp("last_message_at", { withTimezone: true, precision: 3 }).notNull(),
    last_message_preview: text("last_message_preview").notNull(),
    // Denormalized alongside the two columns above, for the same reason —
    // the conversation list needs "did *I* send the last message" (to
    // decide whether to render read-receipt ticks at all) without a join
    // back to `messages`.
    last_message_sender_id: uuid("last_message_sender_id").notNull(),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.last_message_sender_id],
      foreignColumns: [users.id],
      name: "conversations_last_message_sender_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    // Conversation list, newest-active-first — see chatService.listConversations.
    index("conversations_last_message_at_idx").on(table.last_message_at.desc(), table.id.desc()),
    // Partial: only 1:1 conversations have a direct_key, and Postgres's
    // UNIQUE already allows multiple NULLs, but being explicit about the
    // partial predicate here documents *why* instead of relying on that
    // default.
    uniqueIndex("conversations_direct_key_unique")
      .on(table.direct_key)
      .where(sql`${table.direct_key} IS NOT NULL`),
    check(
      "conversations_last_message_preview_length",
      sql`char_length(${table.last_message_preview}) <= 200`
    ),
  ],
);

// Join table (a conversation has many participants, a user is in many
// conversations) — see conversations.ts's comment on why this isn't just
// two FK columns. `last_read_at` lives here, not on `messages`, because
// "read up to" is a per-participant cursor into the conversation, not a
// property of any one message — this is also what makes unread counts and
// read receipts work identically whether the conversation has 2 participants
// or 20.
export const conversation_participants = pgTable(
  "conversation_participants",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversation_id: bigint("conversation_id", { mode: "number" }).notNull(),
    user_id: uuid("user_id").notNull(),

    last_read_at: timestamp("last_read_at", { withTimezone: true, precision: 3 }),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.conversation_id],
      foreignColumns: [conversations.id],
      name: "conversation_participants_conversation_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
      name: "conversation_participants_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    // A user is in a given conversation at most once — also the idempotency
    // guard `findOrCreateConversation` relies on (see chatService).
    uniqueIndex("conversation_participants_conversation_id_user_id_unique").on(
      table.conversation_id,
      table.user_id,
    ),

    // Backs "which conversations is this user in" (chatService.listConversations
    // and the WebSocket handler's on-connect room subscription) — the FK
    // alone isn't enough since this is the reverse direction (by user_id,
    // not conversation_id).
    index("conversation_participants_user_id_idx").on(table.user_id),
  ],
);

// Internal domain entity — bigserial PK (see backend-architect skill's "PK
// type follows the entity's role"). `sender_id` is who sent it; who else
// sees it is derived from `conversation_participants`, not stored per
// message — same normalization reasoning as `last_read_at` above.
export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversation_id: bigint("conversation_id", { mode: "number" }).notNull(),
    sender_id: uuid("sender_id").notNull(),

    kind: text("kind").$type<MessageKind>().notNull().default("text"),

    // Required for `kind = 'text'`; an optional caption for `kind = 'image'`;
    // unused (NULL) for `kind = 'voice'` — see the kind-aware CHECKs below.
    content: text("content"),
    // `kind = 'image'` only — order matters, same "first element is the
    // cover" convention as products.images doesn't apply here (a chat
    // image grid has no single cover), just display order.
    images: text("images").array(),
    // `kind = 'voice'` only — both set together or not at all.
    audio_url: text("audio_url"),
    audio_duration_seconds: integer("audio_duration_seconds"),

    // Edited text messages only (see chatService.editMessage) — `content` is
    // overwritten in place and this is set, so there's no separate edit-
    // history table. `null` means never edited; the frontend's "edited"
    // label condition is just `edited_at != null`.
    edited_at: timestamp("edited_at", { withTimezone: true, precision: 3 }),

    // Soft delete, WhatsApp-style: the row stays (so the conversation's
    // ordering/pagination/last-message-preview logic never has to special-
    // case a hole), but `content`/`images`/`audio_url`/`audio_duration_seconds`
    // are cleared the moment this is set — the other participant should see
    // "this message was deleted," not the original content, and the row's
    // own CHECKs below are relaxed specifically to allow this null-everything
    // state regardless of `kind`.
    deleted_at: timestamp("deleted_at", { withTimezone: true, precision: 3 }),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.conversation_id],
      foreignColumns: [conversations.id],
      name: "messages_conversation_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    foreignKey({
      columns: [table.sender_id],
      foreignColumns: [users.id],
      name: "messages_sender_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    check("messages_kind_valid", sql`${table.kind} IN ('text', 'image', 'voice')`),

    // Each kind owns a disjoint set of required columns — this is the DB
    // backstop behind the discriminated-union Zod schemas in
    // db/validation.ts; a direct insert that skips Zod still can't write a
    // text message with no content or an image message with no images.
    // `OR deleted_at IS NOT NULL` escapes every kind-specific rule below —
    // a deleted message's content is deliberately nulled out regardless of
    // `kind` (see the column comment above), which would otherwise violate
    // every one of these.
    check(
      "messages_text_content_valid",
      sql`${table.deleted_at} IS NOT NULL OR ${table.kind} != 'text' OR (char_length(${table.content}) >= 1 AND char_length(${table.content}) <= 2000)`
    ),
    check(
      "messages_image_content_valid",
      sql`${table.deleted_at} IS NOT NULL OR ${table.kind} != 'image' OR (
        array_length(${table.images}, 1) BETWEEN 1 AND 4
        AND (${table.content} IS NULL OR char_length(${table.content}) <= 2000)
      )`
    ),
    check(
      "messages_voice_content_valid",
      sql`${table.deleted_at} IS NOT NULL OR ${table.kind} != 'voice' OR (
        ${table.audio_url} IS NOT NULL
        AND ${table.audio_duration_seconds} BETWEEN 2 AND 300
      )`
    ),

    // FK columns aren't auto-indexed by Postgres.
    index("messages_sender_id_idx").on(table.sender_id),

    // Backs "this conversation's messages, paginated" — same shape as
    // product_reviews_pagination_idx.
    index("messages_pagination_idx").on(
      table.conversation_id,
      table.created_at.desc(),
      table.id.desc(),
    ),
  ],
);
