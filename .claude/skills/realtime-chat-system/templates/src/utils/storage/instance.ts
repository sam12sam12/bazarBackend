import { isNotNull } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../../db/db";
import { products, stores } from "../../db/schema";
import type { PresignUpload } from "../../db/validation";
import { ApiError } from "../ApiError";
import { createStorage } from "./createStorage";
import { keyFromPublicUrl } from "./client";

// ──────────────────────────────────────────────────────────────────────────
// THE ONE FILE YOU REWRITE PER PROJECT.
//
// Everything else in this folder (client.ts, engine.ts, createStorage.ts,
// index.ts) is a generic, framework-agnostic engine with zero knowledge of
// any specific app — copy it into a new project unchanged. This file is the
// opposite: it's 100% this app's own policy (Hono, Drizzle, whatever tables
// actually hold image/voice urls, `ApiError`) layered on top via
// `createStorage`. A new project reusing this folder deletes this file's
// *contents* and writes its own (see README.md), but the file itself stays
// here — "everything storage lives in one folder" is worth more than a
// stricter but scattered portability boundary.
//
// IMPORTANT for a chat-only setup: `getReferencedKeys` below is written
// against THIS reference project's `products`/`stores` tables — a fresh
// project that only has chat (no product/store image columns) should either
// delete the `sweep` config entirely (chat attachments are cleaned up
// directly by chatService.deleteMessage's reconcile calls, not by this
// sweep — see CLAUDE.md's "Editing and deleting a message") or rewrite
// `getReferencedKeys` to scan whatever tables this project's images
// actually live in.
// ──────────────────────────────────────────────────────────────────────────

// Every url this database currently references, reduced to R2 keys —
// `keyFromPublicUrl` already excludes anything that isn't one of our own
// objects (seed placeholders, etc.), so those never show up as
// "referenced" or "orphaned" either; they're simply not R2's problem.
async function getReferencedKeys(): Promise<Set<string>> {
  const [storeRows, productRows] = await Promise.all([
    db.select({ image: stores.image }).from(stores).where(isNotNull(stores.image)),
    db.select({ images: products.images }).from(products),
  ]);

  const referenced = new Set<string>();
  for (const { image } of storeRows) {
    const key = keyFromPublicUrl(image!);
    if (key) referenced.add(key);
  }
  for (const { images } of productRows) {
    for (const url of images) {
      const key = keyFromPublicUrl(url);
      if (key) referenced.add(key);
    }
  }
  return referenced;
}

export const storage = createStorage({
  image: {
    // Pin this to whatever exact content type the client's pick/compress
    // pipeline always emits — an exact match is only meaningful if the
    // client is under your own control end to end.
    contentType: "image/jpeg",
    maxBytes: 8 * 1024 * 1024, // 8 MB
    // Keyed by the uploading user's id, not by whatever entity the image
    // will end up attached to — a brand-new row doesn't have an id yet at
    // upload time (the client uploads first, then creates the row with the
    // URL already in hand). Scoping the key to the uploader's own id is
    // also the whole security model here: nothing else about this upload
    // is checked server-side, so a user being unable to even construct
    // another user's key is what stops them from overwriting someone
    // else's object.
    buildKey: (userId) => `images/${userId}/${crypto.randomUUID()}.jpg`,
  },
  voice: {
    contentType: "audio/m4a",
    maxBytes: 5 * 1024 * 1024, // 5 MB — chat voice notes: tune to match
    // this project's recorder (sample rate/bitrate/max duration).
    //
    // No content-type check — unlike the image pipeline, the *stored*
    // content-type isn't reliably pinned by the presigned URL's signature
    // in the first place (only `host` is a signed header for a
    // signQuery-style PUT), and what a device's networking layer reports
    // for a local `.m4a` recording has proven genuinely unpredictable in
    // production across Android/iOS content resolvers. The property
    // actually worth enforcing here is already covered elsewhere: the key
    // itself is entirely server-generated (never something a client can
    // choose), and `chatService.ts`'s `assertOwnsAttachment` already
    // confirms the key's user segment matches the sender. Size is what's
    // left, and still is enforced via `maxBytes`.
    skipContentTypeCheck: true,
    buildKey: (userId) => `Voices/${userId}/${crypto.randomUUID()}.m4a`,
  },
  sweep: {
    getReferencedKeys,
    prefix: "images/",
    // Why this is a grace period, not an immediate sweep: see
    // `engine.ts`'s `SweepOptions` comment. 24h.
    gracePeriodMs: 24 * 60 * 60 * 1000,
  },
  // `createStorage`'s validation engine throws a plain `Error` — it has no
  // opinion on any one project's error-handling convention. This is the one
  // place that translates a validation failure into this app's `ApiError`
  // convention (a 400, same as any other bad request).
  onValidationError: (message) => {
    throw ApiError.badRequest(message);
  },
});

// The one HTTP-facing piece of this app's storage integration. Mounted
// directly as `uploadRouter.ts`'s route handler — there's no separate
// `controllers/uploadController.ts` for something this thin.
export async function presignUpload(c: Context) {
  const user = c.get("user");
  const { kind } = c.get("validated") as PresignUpload;

  const { uploadUrl, publicUrl } =
    kind === "voice" ? await storage.createVoiceUploadUrl(user.id) : await storage.createImageUploadUrl(user.id);

  return c.json({ success: true, data: { upload_url: uploadUrl, public_url: publicUrl } });
}
