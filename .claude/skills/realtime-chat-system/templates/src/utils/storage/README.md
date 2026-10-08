# utils/storage

A self-contained R2/S3 upload package: presigned uploads, post-upload
validation, cleanup on replace/delete, and an orphan sweep. Copy this whole
folder into a new project — everything storage-related lives here, including
the one file you edit per project.

## Files

| File              | What it is                                                         | Edit per project? |
| ----------------- | ------------------------------------------------------------------- | --- |
| `client.ts`       | Raw R2/S3 primitives (presign, publicUrlFor, delete, head, list). The only file with an external dependency (`aws4fetch`). | No |
| `engine.ts`       | Every operation built on `client.ts`: presign, validate, reconcile, sweep. | No |
| `createStorage.ts`| The public factory — config in, a ready-to-use storage object out. | No |
| `instance.ts`     | **This app's actual policy** — content types/sizes, key naming, the schema query for the sweep, the HTTP handler. | **Yes** |
| `index.ts`        | Barrel — import the generic engine from `"utils/storage"`. `instance.ts` is imported directly (`"utils/storage/instance"`), not through this barrel, since it's project-specific rather than part of the portable surface. |

`client.ts`/`engine.ts`/`createStorage.ts`/`index.ts` have zero knowledge of
any specific app (no schema, no error class, no web framework) — that's what
makes them safe to drop into a new project unchanged. `instance.ts` is the
opposite on purpose: it's where your app's choices live, kept in this same
folder so there's one place to look, not two.

## 1. Env vars it needs

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL_BASE=     # bucket's public URL, no trailing slash
```

Works against any S3-compatible storage (R2, S3, MinIO) — just point these
at it.

## 2. Set up a new project — rewrite `instance.ts`

Everything else in this folder stays as-is. Replace `instance.ts`'s contents
with your own config:

```ts
import { createStorage } from "./createStorage";

export const storage = createStorage({
  image: {
    contentType: "image/jpeg",
    maxBytes: 8 * 1024 * 1024,
    buildKey: (userId) => `images/${userId}/${crypto.randomUUID()}.jpg`,
  },

  // Optional — omit entirely if you don't have a second upload kind.
  voice: {
    contentType: "audio/m4a",
    maxBytes: 5 * 1024 * 1024,
    buildKey: (userId) => `voices/${userId}/${crypto.randomUUID()}.m4a`,
  },

  // Optional — omit if you don't need the orphan sweep.
  sweep: {
    getReferencedKeys: async () => {
      // Your schema's job: return every R2 key still referenced by a row.
      // The real `instance.ts` in this repo has a worked example against
      // Drizzle tables.
      return new Set<string>();
    },
    prefix: "images/",
    gracePeriodMs: 24 * 60 * 60 * 1000,
  },

  // Optional — translate a validation failure into your app's own error
  // type. Omit it and failures surface as a plain `Error`.
  onValidationError: (message) => {
    throw new Error(message); // swap for your framework's error class
  },
});
```

`buildKey` is required, not defaulted — a guessed file extension is exactly
the kind of default that silently drifts from whatever your upload pipeline
actually produces. State it explicitly.

If your framework needs an HTTP handler (a route that calls
`storage.createImageUploadUrl`/`createVoiceUploadUrl` and returns the
result), add it to `instance.ts` too — see this repo's `presignUpload` for
the Hono version. There's no separate controller file for something that
thin.

## 3. Use it

```ts
import { storage } from "utils/storage/instance";

// Presign an upload
const { uploadUrl, publicUrl } = await storage.createImageUploadUrl(userId);
// → client PUTs their file to uploadUrl, then sends publicUrl to your API

// Before writing publicUrl into a row — reject it if it's fake/oversized/wrong type
await storage.validateNewImages([publicUrl]);          // diffs against existingUrls if passed
await storage.validateChatVoice(voiceUrl);              // single url, no diffing

// After a row update commits — delete whatever the row no longer points at
await storage.reconcileImage(previousUrl, nextUrl);     // single field
await storage.reconcileImages(previousUrls, nextUrls);  // array/gallery field

// Run by hand or on a schedule — deletes anything unreferenced and older
// than gracePeriodMs
const { deleted, failed } = await storage.sweep();
```

No `voice`/`sweep` config → `createVoiceUploadUrl`/`validateChatVoice`/`sweep()`
throw immediately if called, so a missing wire-up fails loudly, not silently.
