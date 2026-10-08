import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db/db";
import type { MessageKind } from "../db/schema";
import { conversation_participants, conversations, messages, users } from "../db/schema";
import { storage } from "../utils/storage/instance";
import { ApiError } from "../utils/ApiError";
import { cursorOrderBy, type CursorData, paginateResults, withCursor } from "../utils/pagination";
import { keyFromPublicUrl } from "../utils/storage";

const MESSAGE_PREVIEW_LENGTH = 200;

// Order-independent so `directKey(a, b) === directKey(b, a)` — the pair is
// the same conversation regardless of who initiated it.
function directKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

const MESSAGE_COLUMNS = {
  id: messages.id,
  conversation_id: messages.conversation_id,
  sender_id: messages.sender_id,
  kind: messages.kind,
  content: messages.content,
  images: messages.images,
  audio_url: messages.audio_url,
  audio_duration_seconds: messages.audio_duration_seconds,
  created_at: messages.created_at,
  edited_at: messages.edited_at,
  deleted_at: messages.deleted_at,
} as const;

type SendMessageParams =
  | { senderId: string; conversationId?: number; recipientId?: string; kind: "text"; content: string }
  | { senderId: string; conversationId?: number; recipientId?: string; kind: "image"; images: string[]; content?: string }
  | {
      senderId: string;
      conversationId?: number;
      recipientId?: string;
      kind: "voice";
      audioUrl: string;
      audioDurationSeconds: number;
    };

// `kind` picks both what gets inserted and the conversation-list preview
// text (plain, backend-generated strings — same "data content, not UI
// chrome" posture as a text message's own `content` already not being
// translated).
function buildPreview(params: SendMessageParams): string {
  if (params.kind === "text") return params.content.slice(0, MESSAGE_PREVIEW_LENGTH);
  if (params.kind === "image") return params.images.length === 1 ? "📷 Photo" : `📷 ${params.images.length} photos`;
  return "🎤 Voice message";
}

// Sibling of buildPreview for recomputing a conversation's list preview from
// an already-stored row (editMessage/deleteMessage), rather than from the
// pre-insert params sendMessage has. "Deleted" overrides every kind — the
// conversation list should read "This message was deleted," not whatever
// the original content/photo-count preview was.
function previewForMessage(message: {
  kind: MessageKind;
  content: string | null;
  images: string[] | null;
  deleted_at: Date | null;
}): string {
  if (message.deleted_at) return "This message was deleted";
  if (message.kind === "text") return (message.content ?? "").slice(0, MESSAGE_PREVIEW_LENGTH);
  if (message.kind === "image") {
    return message.images?.length === 1 ? "📷 Photo" : `📷 ${message.images?.length ?? 0} photos`;
  }
  return "🎤 Voice message";
}

// Editing/deleting a message only needs to touch the conversation's
// denormalized `last_message_preview` when that message is still the
// *latest* one — editing/deleting something further back in history has no
// effect on the conversation list. Returns the new preview if it changed
// (so the caller knows to broadcast `conversation:updated`), `null`
// otherwise.
async function refreshPreviewIfLatest(
  conversationId: number,
  message: { id: number; sender_id: string; kind: MessageKind; content: string | null; images: string[] | null; deleted_at: Date | null },
): Promise<string | null> {
  const [latest] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(desc(messages.created_at), desc(messages.id))
    .limit(1);
  if (!latest || latest.id !== message.id) return null;

  const preview = previewForMessage(message);
  await db
    .update(conversations)
    .set({ last_message_preview: preview, last_message_sender_id: message.sender_id })
    .where(eq(conversations.id, conversationId));
  return preview;
}

// Confirms every url a message references was actually uploaded by this
// sender, before it's ever validated against R2 or written to a row — the
// upload key convention (`images/{userId}/...`, `Voices/{userId}/...`, see
// utils/storage/instance.ts) embeds the uploader's id specifically so this check is
// possible; a url whose key belongs to a different user can only mean the
// client fabricated or copied someone else's upload URL.
function assertOwnsAttachment(url: string, senderId: string, prefix: "images" | "Voices"): void {
  const key = keyFromPublicUrl(url);
  if (!key || !key.startsWith(`${prefix}/${senderId}/`)) {
    throw ApiError.forbidden("Attachment does not belong to this user");
  }
}

async function validateAttachments(params: SendMessageParams): Promise<void> {
  if (params.kind === "image") {
    for (const url of params.images) assertOwnsAttachment(url, params.senderId, "images");
    await storage.validateChatImages(params.images);
  } else if (params.kind === "voice") {
    assertOwnsAttachment(params.audioUrl, params.senderId, "Voices");
    await storage.validateChatVoice(params.audioUrl);
  }
}

export const chatService = {
  // ── Membership check every WS/REST operation on an existing conversation
  // goes through — a client-supplied conversation_id is never trusted on
  // its own (see middlewares/authMiddleware.ts's comment: this is the one
  // feature with a real session, so this check is real, not a placeholder). ──
  async isParticipant(conversationId: number, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: conversation_participants.id })
      .from(conversation_participants)
      .where(
        and(
          eq(conversation_participants.conversation_id, conversationId),
          eq(conversation_participants.user_id, userId),
        ),
      )
      .limit(1);
    return !!row;
  },

  async getParticipantIds(conversationId: number): Promise<string[]> {
    const rows = await db
      .select({ user_id: conversation_participants.user_id })
      .from(conversation_participants)
      .where(eq(conversation_participants.conversation_id, conversationId));
    return rows.map((r) => r.user_id);
  },

  // Batched sibling of getParticipantIds — one query for every conversation
  // id the caller has, instead of one round-trip per id. wsRouter.ts's
  // contactsFor() used to run `conversationIds.length` separate queries on
  // every single socket connect/disconnect; this collapses that to one
  // `WHERE conversation_id IN (...)`.
  async getParticipantIdsForConversations(conversationIds: number[]): Promise<Map<number, string[]>> {
    const result = new Map<number, string[]>();
    if (conversationIds.length === 0) return result;

    const rows = await db
      .select({
        conversation_id: conversation_participants.conversation_id,
        user_id: conversation_participants.user_id,
      })
      .from(conversation_participants)
      .where(inArray(conversation_participants.conversation_id, conversationIds));

    for (const row of rows) {
      const list = result.get(row.conversation_id);
      if (list) list.push(row.user_id);
      else result.set(row.conversation_id, [row.user_id]);
    }
    return result;
  },

  // Looks for an existing 1:1 conversation between exactly these two users
  // via its `direct_key` (see chatSchema.ts's comment) — a single indexed
  // equality lookup, not a join.
  async findConversationBetween(userA: string, userB: string): Promise<number | null> {
    const [row] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.direct_key, directKey(userA, userB)))
      .limit(1);

    return row?.id ?? null;
  },

  // Sends a message, creating the conversation (and both participant rows)
  // on the first message if one doesn't exist yet — see chatSchema.ts's
  // comment on why conversations are never created empty. Returns the
  // inserted message plus enough context for the caller (wsRouter.ts) to
  // broadcast correctly: whether a new conversation was created (so the
  // sender's socket can subscribe to its room) and who else to notify.
  async sendMessage(params: SendMessageParams) {
    const { senderId } = params;
    let conversationId = params.conversationId;
    let created = false;

    // Reject before touching the conversation/message tables at all — an
    // invalid or not-this-sender's attachment should never get as far as
    // creating a brand-new conversation for it.
    await validateAttachments(params);

    const preview = buildPreview(params);

    if (conversationId != null) {
      const member = await chatService.isParticipant(conversationId, senderId);
      if (!member) throw ApiError.forbidden("Not a participant in this conversation");
    } else {
      if (!params.recipientId) throw ApiError.badRequest("recipient_id is required");
      if (params.recipientId === senderId) throw ApiError.badRequest("Cannot message yourself");

      // Atomic find-or-create via the `direct_key` unique index (see
      // chatSchema.ts) instead of check-then-insert: two people messaging
      // each other for the first time at the same instant both race this
      // same INSERT, exactly one wins the row, the other's insert is a
      // silent no-op and falls through to the re-select below — never two
      // conversations for the same pair.
      const key = directKey(senderId, params.recipientId);
      const [won] = await db
        .insert(conversations)
        .values({ direct_key: key, last_message_at: new Date(), last_message_preview: preview, last_message_sender_id: senderId })
        // The `where` here must mirror `conversations_direct_key_unique`'s
        // partial predicate exactly — Postgres only infers a partial unique
        // index as the ON CONFLICT arbiter when the clause matches, it
        // won't match a plain `ON CONFLICT (direct_key)` against it.
        .onConflictDoNothing({ target: conversations.direct_key, where: sql`${conversations.direct_key} IS NOT NULL` })
        .returning({ id: conversations.id });

      if (won) {
        conversationId = won.id;
        created = true;
        await db.insert(conversation_participants).values([
          { conversation_id: conversationId, user_id: senderId },
          { conversation_id: conversationId, user_id: params.recipientId },
        ]);
      } else {
        conversationId = await chatService.findConversationBetween(senderId, params.recipientId) ?? undefined;
        if (conversationId == null) throw ApiError.internal("Failed to resolve conversation");
      }
    }

    const values =
      params.kind === "text"
        ? { kind: "text" as MessageKind, content: params.content }
        : params.kind === "image"
          ? { kind: "image" as MessageKind, content: params.content, images: params.images }
          : {
              kind: "voice" as MessageKind,
              audio_url: params.audioUrl,
              audio_duration_seconds: params.audioDurationSeconds,
            };

    const [message] = await db
      .insert(messages)
      .values({ conversation_id: conversationId, sender_id: senderId, ...values })
      .returning(MESSAGE_COLUMNS);

    if (!created) {
      await db
        .update(conversations)
        .set({
          last_message_at: message.created_at,
          last_message_preview: preview,
          last_message_sender_id: senderId,
        })
        .where(eq(conversations.id, conversationId));
    }

    const participantIds = await chatService.getParticipantIds(conversationId);
    return { message, conversationId, created, participantIds, preview };
  },

  // Only the sender may edit their own message, only while it isn't
  // deleted, and only text — WhatsApp-style, editing a photo/voice note
  // isn't a thing since there's no "caption" field to amend separately on
  // this schema. Overwrites `content` in place and stamps `edited_at`;
  // there's no edit-history table, so the previous content isn't
  // recoverable once edited (same posture as a real delete, just reversible
  // by sending the old text again manually).
  async editMessage(messageId: number, conversationId: number, userId: string, content: string) {
    const [current] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!current || current.conversation_id !== conversationId) throw ApiError.notFound("Message not found");
    if (current.sender_id !== userId) throw ApiError.forbidden("You can only edit your own messages");
    if (current.deleted_at) throw ApiError.forbidden("Cannot edit a deleted message");
    if (current.kind !== "text") throw ApiError.badRequest("Only text messages can be edited");

    const [updated] = await db
      .update(messages)
      .set({ content, edited_at: new Date() })
      .where(eq(messages.id, messageId))
      .returning(MESSAGE_COLUMNS);

    const preview = await refreshPreviewIfLatest(conversationId, updated);
    const participantIds = await chatService.getParticipantIds(conversationId);
    return { message: updated, participantIds, preview };
  },

  // Soft delete — WhatsApp-style "delete for everyone," not a hide-for-me.
  // Clears the payload columns (regardless of `kind`; see the schema
  // comment on why the CHECKs allow this) and stamps `deleted_at`; the row
  // itself stays so pagination/ordering/last-message-preview logic never
  // has to special-case a hole in the sequence. Idempotent: deleting an
  // already-deleted message re-returns its current state instead of
  // erroring or bumping `deleted_at` again, since a client retry/double-tap
  // shouldn't be treated as a failure.
  async deleteMessage(messageId: number, conversationId: number, userId: string) {
    const [current] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!current || current.conversation_id !== conversationId) throw ApiError.notFound("Message not found");
    if (current.sender_id !== userId) throw ApiError.forbidden("You can only delete your own messages");

    const [updated] = current.deleted_at
      ? await db.select(MESSAGE_COLUMNS).from(messages).where(eq(messages.id, messageId))
      : await db
          .update(messages)
          .set({ content: null, images: null, audio_url: null, audio_duration_seconds: null, deleted_at: new Date() })
          .where(eq(messages.id, messageId))
          .returning(MESSAGE_COLUMNS);

    // Clearing the row's columns above doesn't touch R2 on its own — once
    // nothing references an uploaded image/voice object, it's this app's
    // job to delete it (same "DB write commits, then reconcile storage"
    // order other services use), not something an orphan sweep would ever
    // catch if that sweep only scans other tables, never chat attachments.
    // Only run this on the actual delete, not the idempotent re-delete
    // branch above — the first delete already cleaned these same keys up.
    if (!current.deleted_at) {
      if (current.kind === "image" && current.images?.length) {
        await storage.reconcileImages(current.images, []);
      } else if (current.kind === "voice" && current.audio_url) {
        await storage.reconcileImage(current.audio_url, null);
      }
    }

    const preview = await refreshPreviewIfLatest(conversationId, updated);
    const participantIds = await chatService.getParticipantIds(conversationId);
    return { message: updated, participantIds, preview };
  },

  // ── This user's conversations, newest-active-first. 1:1-only for now —
  // the join to `other` assumes exactly one other participant row per
  // conversation (true as long as nothing creates a group conversation).
  // `unread_count` is a correlated subquery rather than a join+group by:
  // reads directly as "count of messages after my last_read_at," and at
  // 1:1-chat scale (a handful of conversations per user, each with a
  // messages_pagination_idx-backed lookup) a subquery per row costs nothing
  // worth optimizing away. ──
  async listConversations(userId: string, limit: number, cursor?: CursorData) {
    const other = alias(conversation_participants, "other");
    const my = conversation_participants;

    const columns = {
      id: conversations.id,
      last_message_preview: conversations.last_message_preview,
      last_message_sender_id: conversations.last_message_sender_id,
      created_at: conversations.last_message_at,
      other_user: { id: users.id, name: users.name, avatar: users.avatar },
      unread_count: sql<number>`(
        select count(*)::int from ${messages}
        where ${messages.conversation_id} = ${conversations.id}
          and ${messages.sender_id} != ${userId}
          and (${my.last_read_at} is null or ${messages.created_at} > ${my.last_read_at})
      )`,
    };

    const whereCondition = withCursor(
      { created_at: conversations.last_message_at, id: conversations.id },
      cursor,
      eq(my.user_id, userId),
    );

    const results = await db
      .select(columns)
      .from(conversations)
      .innerJoin(my, eq(my.conversation_id, conversations.id))
      .innerJoin(other, and(eq(other.conversation_id, conversations.id), ne(other.user_id, userId)))
      .innerJoin(users, eq(users.id, other.user_id))
      .where(whereCondition)
      .orderBy(...cursorOrderBy({ created_at: conversations.last_message_at, id: conversations.id }))
      .limit(limit + 1);

    const { list, nextCursor, hasMore } = paginateResults(results, limit);
    return { conversations: list, nextCursor, hasMore };
  },

  async getMessages(conversationId: number, userId: string, limit: number, cursor?: CursorData) {
    const member = await chatService.isParticipant(conversationId, userId);
    if (!member) throw ApiError.forbidden("Not a participant in this conversation");

    const [results, otherLastReadAt] = await Promise.all([
      db
        .select(MESSAGE_COLUMNS)
        .from(messages)
        .where(withCursor(messages, cursor, eq(messages.conversation_id, conversationId)))
        .orderBy(...cursorOrderBy(messages))
        .limit(limit + 1),
      chatService.getOtherParticipantLastReadAt(conversationId, userId),
    ]);

    const { list, nextCursor, hasMore } = paginateResults(results, limit);
    // The client's read-receipt state only ever gets updated by *live*
    // `read` WebSocket events while connected — it's never persisted or
    // re-fetched on its own client-side. Without this, a message already
    // seen before the app was closed would render as merely "delivered"
    // again after a fresh launch, until the other participant happens to
    // read something new. Including the real value here lets the client
    // re-hydrate that state from the actual source of truth
    // (`conversation_participants.last_read_at`) every time message
    // history loads, not just from live events.
    return { messages: list, nextCursor, hasMore, other_last_read_at: otherLastReadAt };
  },

  // The one other participant's read cursor in this (1:1) conversation —
  // `null` if they've never read anything yet. See `getMessages`'s comment
  // on why the client needs this outside of live `read` events.
  async getOtherParticipantLastReadAt(conversationId: number, userId: string): Promise<string | null> {
    const [row] = await db
      .select({ last_read_at: conversation_participants.last_read_at })
      .from(conversation_participants)
      .where(
        and(
          eq(conversation_participants.conversation_id, conversationId),
          ne(conversation_participants.user_id, userId),
        ),
      )
      .limit(1);
    return row?.last_read_at ? row.last_read_at.toISOString() : null;
  },

  // For the "message this user" entry point (e.g. a store's contact-seller
  // button) where the caller only knows the other user's id, not whether a
  // conversation already exists. Returns `conversation_id: null` and an
  // empty page rather than creating one — a conversation is only ever
  // created by actually sending a message (see sendMessage above).
  async getMessagesWithUser(userId: string, otherUserId: string, limit: number, cursor?: CursorData) {
    const conversationId = await chatService.findConversationBetween(userId, otherUserId);
    if (conversationId == null) return { conversation_id: null, messages: [], nextCursor: null, hasMore: false };

    const { messages: list, nextCursor, hasMore } = await chatService.getMessages(
      conversationId,
      userId,
      limit,
      cursor,
    );
    return { conversation_id: conversationId, messages: list, nextCursor, hasMore };
  },

  async markRead(conversationId: number, userId: string) {
    const member = await chatService.isParticipant(conversationId, userId);
    if (!member) throw ApiError.forbidden("Not a participant in this conversation");

    const readAt = new Date();
    await db
      .update(conversation_participants)
      .set({ last_read_at: readAt })
      .where(
        and(
          eq(conversation_participants.conversation_id, conversationId),
          eq(conversation_participants.user_id, userId),
        ),
      );
    return { readAt };
  },
};
