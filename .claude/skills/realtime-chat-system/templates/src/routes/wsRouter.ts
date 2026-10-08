import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";
import { z } from "zod";
import { db } from "../db/db";
import { conversation_participants } from "../db/schema";
import { sendImageMessageSchema, sendTextMessageSchema, sendVoiceMessageSchema } from "../db/validation";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createRateLimiter } from "../middlewares/rateLimiter";
import { chatService } from "../services/chatService";
import { getOnlineUserIds, registerConnection, unregisterConnection } from "../lib/chatHub";
import { fanoutBroadcast, fanoutFromConnection } from "../lib/pubsub";

// Everything a connected client can send. Kept local to this file rather
// than db/validation.ts — these are WebSocket protocol frames, not
// table-backed REST bodies, so they don't belong next to the drizzle-zod
// schemas that file is for.
//
// `message:send` is itself a `kind`-discriminated union (text/image/voice —
// see db/validation.ts's comment on why) nested inside the `type`-
// discriminated union of every frame kind — two different discriminants,
// so the outer union can't be `z.discriminatedUnion` (it requires a single
// literal key directly on every member, and a nested union isn't a plain
// object `discriminatedUnion` can inspect for one). A plain `z.union` costs
// nothing noticeable for a handful of small control frames.
const messageSendFrame = z
  .union([
    sendTextMessageSchema.extend({ type: z.literal("message:send") }),
    sendImageMessageSchema.extend({ type: z.literal("message:send") }),
    sendVoiceMessageSchema.extend({ type: z.literal("message:send") }),
  ])
  .refine((data) => data.conversation_id != null || data.recipient_id != null, {
    message: "Either conversation_id or recipient_id is required",
    path: ["conversation_id"],
  });

const clientMessageSchema = z.union([
  z.object({ type: z.literal("join"), conversation_id: z.number().int().positive() }),
  messageSendFrame,
  z.object({ type: z.literal("typing:start"), conversation_id: z.number().int().positive() }),
  z.object({ type: z.literal("typing:stop"), conversation_id: z.number().int().positive() }),
  // Same shape and purpose as typing:start/stop — "the other participant's
  // header should show an activity indicator right now" — just for an
  // in-progress voice recording instead of a typed draft. Kept as its own
  // frame/broadcast type rather than folded into "typing" so a client can
  // tell the two apart (e.g. recording could reasonably take visual
  // priority if both were ever somehow true at once).
  z.object({ type: z.literal("recording:start"), conversation_id: z.number().int().positive() }),
  z.object({ type: z.literal("recording:stop"), conversation_id: z.number().int().positive() }),
  z.object({ type: z.literal("read"), conversation_id: z.number().int().positive() }),
  // WhatsApp-style edit/delete — see chatService.editMessage/deleteMessage
  // for the ownership/kind/already-deleted rules each enforces server-side.
  z.object({
    type: z.literal("message:edit"),
    conversation_id: z.number().int().positive(),
    message_id: z.number().int().positive(),
    content: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal("message:delete"),
    conversation_id: z.number().int().positive(),
    message_id: z.number().int().positive(),
  }),
]);

const conversationTopic = (id: number) => `conversation:${id}`;
const userTopic = (userId: string) => `user:${userId}`;

// Every DB-writing frame (send/edit/delete) shares one process-wide bucket
// per user — same in-memory, single-instance posture as
// middlewares/rateLimiter.ts's REST limiter (see that file's comment), just
// consumed directly instead of as Hono middleware since a WebSocket's
// `onMessage` has no `next()` to wrap. 20 writes per 10s is generous for a
// real conversation (bursts of a few messages in a row) while still
// stopping a scripted client from hammering Postgres for free.
const messageWriteLimiter = createRateLimiter({ windowMs: 10_000, max: 20 });

async function getConversationIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ conversation_id: conversation_participants.conversation_id })
    .from(conversation_participants)
    .where(eq(conversation_participants.user_id, userId));
  return rows.map((r) => r.conversation_id);
}

async function contactsFor(conversationIds: number[], excludingUserId: string): Promise<string[]> {
  const byConversation = await chatService.getParticipantIdsForConversations(conversationIds);
  const allParticipants = [...byConversation.values()].flat();
  return [...new Set(allParticipants.filter((id) => id !== excludingUserId))];
}

const router = new Hono();

// Auth happens before the upgrade (see authMiddleware.ts) — an
// unauthenticated request never becomes a WebSocket, it just gets a normal
// 401 JSON response through the existing global error handler, same as any
// other rejected request.
router.get(
  "/",
  authMiddleware,
  upgradeWebSocket((c) => {
    const user = c.get("user");
    // Populated in onOpen, kept current as new conversations start during
    // this connection's lifetime — reused in onClose so presence can be
    // broadcast to every contact this user is actually in a conversation
    // with, without a second DB round-trip at disconnect time.
    let conversationIds: number[] = [];

    // Which conversations this connection last announced itself as
    // typing/recording in, so onClose can announce a stop for each — without
    // this, a client that disconnects mid-typing (crash, lost signal, app
    // killed) leaves the other participant's "typing…" indicator stuck on
    // forever, since the only thing that would otherwise clear it is a
    // typing:stop frame this connection will now never send.
    const typingIn = new Set<number>();
    const recordingIn = new Set<number>();

    return {
      async onOpen(_evt, ws) {
        const raw = ws.raw as ServerWebSocket<unknown>;
        conversationIds = await getConversationIds(user.id);

        raw.subscribe(userTopic(user.id));
        for (const id of conversationIds) raw.subscribe(conversationTopic(id));

        const contacts = await contactsFor(conversationIds, user.id);

        // Tell this client who's already online, immediately — otherwise
        // it would have to wait for the other side's next connect/disconnect
        // to find out, since presence events only fire on state *changes*.
        ws.send(JSON.stringify({ type: "ready", online_user_ids: await getOnlineUserIds(contacts) }));

        const justCameOnline = await registerConnection(user.id);
        if (justCameOnline) {
          const payload = JSON.stringify({ type: "presence", user_id: user.id, online: true });
          for (const contactId of contacts) fanoutBroadcast(userTopic(contactId), payload);
        }
      },

      async onMessage(evt, ws) {
        const raw = ws.raw as ServerWebSocket<unknown>;

        let parsed: z.infer<typeof clientMessageSchema>;
        try {
          parsed = clientMessageSchema.parse(JSON.parse(String(evt.data)));
        } catch {
          ws.send(JSON.stringify({ type: "error", error: "Invalid message" }));
          return;
        }

        try {
          switch (parsed.type) {
            case "join": {
              const member = await chatService.isParticipant(parsed.conversation_id, user.id);
              if (!member) {
                ws.send(JSON.stringify({ type: "error", error: "Not a participant" }));
                return;
              }
              raw.subscribe(conversationTopic(parsed.conversation_id));
              if (!conversationIds.includes(parsed.conversation_id)) {
                conversationIds.push(parsed.conversation_id);
              }
              return;
            }

            case "message:send": {
              if (!messageWriteLimiter.consume(user.id)) {
                ws.send(JSON.stringify({ type: "error", error: "Too many messages — slow down", client_id: parsed.client_id }));
                return;
              }

              const base = { senderId: user.id, conversationId: parsed.conversation_id, recipientId: parsed.recipient_id };
              const sendParams =
                parsed.kind === "text"
                  ? { ...base, kind: "text" as const, content: parsed.content }
                  : parsed.kind === "image"
                    ? { ...base, kind: "image" as const, images: parsed.images, content: parsed.content }
                    : {
                        ...base,
                        kind: "voice" as const,
                        audioUrl: parsed.audio_url,
                        audioDurationSeconds: parsed.audio_duration_seconds,
                      };

              const { message, conversationId, created, participantIds, preview } = await chatService.sendMessage(sendParams);

              if (created) {
                raw.subscribe(conversationTopic(conversationId));
                conversationIds.push(conversationId);
              }

              // `fanoutFromConnection` (not `fanoutBroadcast`) deliberately —
              // it publishes locally via `raw.publish`, which excludes this
              // exact connection by default (`publishToSelf: false`), so the
              // sender's other open devices still get it via the room, while
              // the sender's own optimistic UI on *this* connection is
              // reconciled below via the direct `ws.send` instead of
              // receiving a duplicate. It also mirrors the publish through
              // Redis so a recipient connected to a *different* backend
              // instance still gets it (see pubsub.ts).
              const newMessagePayload = JSON.stringify({
                type: "message:new",
                message,
                client_id: parsed.client_id,
              });
              fanoutFromConnection(raw, conversationTopic(conversationId), newMessagePayload);
              ws.send(newMessagePayload);

              const updatePayload = JSON.stringify({
                type: "conversation:updated",
                conversation_id: conversationId,
                last_message_preview: preview,
                created_at: message.created_at,
              });
              for (const participantId of participantIds) {
                fanoutFromConnection(raw, userTopic(participantId), updatePayload);
              }
              return;
            }

            case "message:edit": {
              if (!messageWriteLimiter.consume(user.id)) {
                ws.send(JSON.stringify({ type: "error", error: "Too many messages — slow down" }));
                return;
              }

              const { message, participantIds, preview } = await chatService.editMessage(
                parsed.message_id,
                parsed.conversation_id,
                user.id,
                parsed.content,
              );

              const updatedPayload = JSON.stringify({ type: "message:updated", message });
              fanoutFromConnection(raw, conversationTopic(parsed.conversation_id), updatedPayload);
              ws.send(updatedPayload);

              // Only the conversation list needs a separate broadcast, and
              // only if this message was still the latest one — see
              // chatService.refreshPreviewIfLatest's comment.
              if (preview != null) {
                const previewPayload = JSON.stringify({
                  type: "conversation:updated",
                  conversation_id: parsed.conversation_id,
                  last_message_preview: preview,
                  created_at: message.created_at,
                });
                for (const participantId of participantIds) {
                  fanoutFromConnection(raw, userTopic(participantId), previewPayload);
                }
              }
              return;
            }

            case "message:delete": {
              const { message, participantIds, preview } = await chatService.deleteMessage(
                parsed.message_id,
                parsed.conversation_id,
                user.id,
              );

              const updatedPayload = JSON.stringify({ type: "message:updated", message });
              fanoutFromConnection(raw, conversationTopic(parsed.conversation_id), updatedPayload);
              ws.send(updatedPayload);

              if (preview != null) {
                const previewPayload = JSON.stringify({
                  type: "conversation:updated",
                  conversation_id: parsed.conversation_id,
                  last_message_preview: preview,
                  created_at: message.created_at,
                });
                for (const participantId of participantIds) {
                  fanoutFromConnection(raw, userTopic(participantId), previewPayload);
                }
              }
              return;
            }

            case "typing:start":
            case "typing:stop": {
              const member = await chatService.isParticipant(parsed.conversation_id, user.id);
              if (!member) return;

              if (parsed.type === "typing:start") typingIn.add(parsed.conversation_id);
              else typingIn.delete(parsed.conversation_id);

              fanoutFromConnection(
                raw,
                conversationTopic(parsed.conversation_id),
                JSON.stringify({
                  type: "typing",
                  conversation_id: parsed.conversation_id,
                  user_id: user.id,
                  is_typing: parsed.type === "typing:start",
                }),
              );
              return;
            }

            case "recording:start":
            case "recording:stop": {
              const member = await chatService.isParticipant(parsed.conversation_id, user.id);
              if (!member) return;

              if (parsed.type === "recording:start") recordingIn.add(parsed.conversation_id);
              else recordingIn.delete(parsed.conversation_id);

              fanoutFromConnection(
                raw,
                conversationTopic(parsed.conversation_id),
                JSON.stringify({
                  type: "recording",
                  conversation_id: parsed.conversation_id,
                  user_id: user.id,
                  is_recording: parsed.type === "recording:start",
                }),
              );
              return;
            }

            case "read": {
              const { readAt } = await chatService.markRead(parsed.conversation_id, user.id);
              fanoutFromConnection(
                raw,
                conversationTopic(parsed.conversation_id),
                JSON.stringify({
                  type: "read",
                  conversation_id: parsed.conversation_id,
                  user_id: user.id,
                  read_at: readAt,
                }),
              );
              return;
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Something went wrong";
          console.error(`wsRouter: ${parsed?.type ?? "unknown"} failed for user ${user.id}:`, message);
          // `client_id` lets the client correlate this rejection back to the
          // specific optimistic message it needs to roll back — without it,
          // a failed `message:send` (e.g. attachment validation) is
          // indistinguishable from any other error and the client has no
          // way to know which pending send to clean up.
          const clientId = parsed?.type === "message:send" ? parsed.client_id : undefined;
          ws.send(JSON.stringify({ type: "error", error: message, client_id: clientId }));
        }
      },

      async onClose() {
        // No `raw`/`ws` available anymore by the time onClose fires — these
        // go through fanoutBroadcast (server-wide publish), same as the
        // presence announcement below, not fanoutFromConnection.
        for (const conversationId of typingIn) {
          fanoutBroadcast(
            conversationTopic(conversationId),
            JSON.stringify({ type: "typing", conversation_id: conversationId, user_id: user.id, is_typing: false }),
          );
        }
        for (const conversationId of recordingIn) {
          fanoutBroadcast(
            conversationTopic(conversationId),
            JSON.stringify({ type: "recording", conversation_id: conversationId, user_id: user.id, is_recording: false }),
          );
        }

        const justWentOffline = await unregisterConnection(user.id);
        if (!justWentOffline) return;

        const contacts = await contactsFor(conversationIds, user.id);
        const payload = JSON.stringify({ type: "presence", user_id: user.id, online: false });
        for (const contactId of contacts) fanoutBroadcast(userTopic(contactId), payload);
      },
    };
  }),
);

export default router;
