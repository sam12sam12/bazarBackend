import {
  createUploadUrl,
  reconcileMany,
  reconcileOne,
  sweep as runSweep,
  validateNewUrls,
  validateUploadedObject,
  type SweepOptions,
  type UploadExpectation,
} from "./engine";

export interface StorageKindConfig {
  contentType: string;
  maxBytes: number;
  // Where/how this kind's objects are keyed — required, not defaulted.
  // A guessed extension (e.g. deriving ".jpeg" from "image/jpeg") looks
  // reasonable but is exactly the kind of default that silently diverges
  // from whatever extension convention a real upload pipeline actually
  // committed to (this app's own is ".jpg", not the ".jpeg" a naive guess
  // would produce) — cheaper to require callers state it than to ship a
  // plausible-looking wrong default.
  buildKey: (userId: string) => string;
  // Some upload pipelines genuinely can't trust the stored object's
  // content-type (see a real example of why in this project's
  // `instance.ts` voice-note config) — set this to skip that half of
  // validation and rely on `maxBytes` alone.
  skipContentTypeCheck?: boolean;
}

export interface StorageModuleConfig {
  image: StorageKindConfig;
  // Optional — omit entirely for a project with no second upload kind.
  voice?: StorageKindConfig;
  // Everything the orphan sweep needs that this package structurally can't
  // know on its own: which keys your own schema still references. Omit if
  // you don't need the sweep.
  sweep?: SweepOptions;
  // Translates a validation failure's message into your app's own error
  // convention, e.g. `(message) => { throw ApiError.badRequest(message) }`.
  // Left unset, validation failures surface as a plain `Error`.
  onValidationError?: (message: string) => never;
}

function toExpectation(kind: StorageKindConfig, label: string): UploadExpectation {
  return {
    isAcceptableContentType: kind.skipContentTypeCheck ? undefined : (ct) => ct === kind.contentType,
    maxBytes: kind.maxBytes,
    notFoundMessage: `Uploaded ${label} could not be found — please pick it again.`,
    invalidMessage: `Uploaded ${label} is invalid or too large.`,
  };
}

// The one call a consuming project makes: hand it this app's own policy —
// accepted content types/sizes, how to find referenced keys for the orphan
// sweep, how a validation failure should surface — and get back a
// ready-to-use storage object. Everything else in this folder is the
// generic engine behind it; this factory is what turns "generic R2
// helpers" into "this app's upload/storage service" in one file instead of
// several hand-wired ones. A project whose upload needs don't fit the
// image/voice shape here can still reach for `engine.ts`'s functions
// directly — this factory covers the common case, it isn't the only way in.
export function createStorage(config: StorageModuleConfig) {
  const imageExpectation = toExpectation(config.image, "image");
  const voiceExpectation = config.voice ? toExpectation(config.voice, "voice note") : undefined;

  async function guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Error && config.onValidationError) config.onValidationError(error.message);
      throw error;
    }
  }

  function requireVoiceConfig() {
    if (!config.voice || !voiceExpectation) throw new Error("createStorage: no `voice` config was supplied");
  }

  function requireSweepConfig() {
    if (!config.sweep) throw new Error("createStorage: no `sweep` config was supplied");
  }

  return {
    createImageUploadUrl(userId: string) {
      return createUploadUrl(config.image.buildKey(userId), config.image.contentType);
    },
    createVoiceUploadUrl(userId: string) {
      requireVoiceConfig();
      return createUploadUrl(config.voice!.buildKey(userId), config.voice!.contentType);
    },

    // Validates every url in `urls` that doesn't already appear in
    // `existingUrls` — i.e. only what's genuinely new in this request.
    validateNewImages(urls: string[], existingUrls: string[] = []) {
      return guarded(() => validateNewUrls(urls, existingUrls, imageExpectation));
    },
    // Every url is validated, not just a diff — for flows where "new" is
    // always true (e.g. a chat message's attachments are never edited).
    validateChatImages(urls: string[]) {
      return guarded(() => validateNewUrls(urls, [], imageExpectation));
    },
    validateChatVoice(url: string) {
      requireVoiceConfig();
      return guarded(() => validateUploadedObject(url, voiceExpectation!));
    },

    reconcileImage: reconcileOne,
    reconcileImages: reconcileMany,

    sweep() {
      requireSweepConfig();
      return runSweep(config.sweep!);
    },
  };
}
