import type { Context } from "hono";
import type { PresignUpload } from "../../db/validation";
import { ApiError } from "../ApiError";
import { createStorage } from "./createStorage";

// ──────────────────────────────────────────────────────────────────────────
// THE ONE FILE YOU REWRITE PER PROJECT. Everything else in this folder
// (client.ts, engine.ts, createStorage.ts, index.ts) is a generic,
// framework-agnostic engine — copy it into a new project unchanged. See
// README.md in this folder for the full guide.
//
// No `sweep` config here: this starter's one example table (`items`, see
// db/schema/exampleSchema.ts) has no image column, so there's nothing yet
// for an orphan sweep to check against. Add one real `getReferencedKeys`
// query (see README.md's worked example) once a real table has an image/
// gallery column.
// ──────────────────────────────────────────────────────────────────────────
export const storage = createStorage({
  image: {
    contentType: "image/jpeg",
    maxBytes: 8 * 1024 * 1024, // 8 MB
    buildKey: (userId) => `images/${userId}/${crypto.randomUUID()}.jpg`,
  },

  // `createStorage`'s validation engine throws a plain `Error` — this is
  // the one place that translates a validation failure into this app's
  // `ApiError` convention (a 400, same as any other bad request).
  onValidationError: (message) => {
    throw ApiError.badRequest(message);
  },
});

// The one HTTP-facing piece of this app's storage integration. Mounted
// directly as uploadRouter.ts's route handler — there's no separate
// `controllers/uploadController.ts` for something this thin.
export async function presignUpload(c: Context) {
  const user = c.get("user");
  const { kind } = c.get("validated") as PresignUpload;

  const { uploadUrl, publicUrl } =
    kind === "voice" ? await storage.createVoiceUploadUrl(user.id) : await storage.createImageUploadUrl(user.id);

  return c.json({ success: true, data: { upload_url: uploadUrl, public_url: publicUrl } });
}
