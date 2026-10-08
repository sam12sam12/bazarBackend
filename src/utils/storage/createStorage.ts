import {
	createUploadUrl,
	reconcileMany,
	reconcileOne,
	sweep as runSweep,
	type SweepOptions,
	type UploadExpectation,
	validateNewUrls,
	validateUploadedObject,
} from './engine'

export interface StorageKindConfig {
	contentType: string
	maxBytes: number
	// Where/how this kind's objects are keyed — required, not defaulted. A
	// guessed extension (e.g. deriving ".jpeg" from "image/jpeg") looks
	// reasonable but is exactly the kind of default that silently diverges
	// from whatever extension convention a real upload pipeline actually
	// committed to — cheaper to require callers state it than to ship a
	// plausible-looking wrong default.
	buildKey: (userId: string) => string
	// Some upload pipelines genuinely can't trust the stored object's
	// content-type (see `instance.ts`'s voice-note config for why) — set
	// this to skip that half of validation and rely on `maxBytes` alone.
	skipContentTypeCheck?: boolean
}

export interface StorageModuleConfig {
	image: StorageKindConfig
	// Optional second kind — e.g. chat voice notes. Omit if a project only
	// ever presigns images.
	voice?: StorageKindConfig
	// Everything the orphan sweep needs that this package structurally can't
	// know on its own: which keys your own schema still references. Omit if
	// you don't need the sweep.
	sweep?: SweepOptions
	// Translates a validation failure's message into your app's own error
	// convention, e.g. `(message) => { throw ApiError.badRequest(message) }`.
	// Left unset, validation failures surface as a plain `Error`.
	onValidationError?: (message: string) => never
}

function toExpectation(
	kind: StorageKindConfig,
	label: string,
): UploadExpectation {
	return {
		isAcceptableContentType: kind.skipContentTypeCheck
			? undefined
			: (ct) => ct === kind.contentType,
		maxBytes: kind.maxBytes,
		notFoundMessage: `Uploaded ${label} could not be found — please pick it again.`,
		invalidMessage: `Uploaded ${label} is invalid or too large.`,
	}
}

// The one call a consuming project makes: hand it this app's own policy —
// accepted content types/sizes, how to find referenced keys for the orphan
// sweep, how a validation failure should surface — and get back a
// ready-to-use storage object. Everything else in this folder is the
// generic engine behind it; this factory is what turns "generic R2 helpers"
// into "this app's upload/storage service" in one file instead of several
// hand-wired ones.
export function createStorage(config: StorageModuleConfig) {
	const imageExpectation = toExpectation(config.image, 'image')

	async function guarded<T>(fn: () => Promise<T>): Promise<T> {
		try {
			return await fn()
		} catch (error) {
			if (error instanceof Error && config.onValidationError) {
				config.onValidationError(error.message)
			}
			throw error
		}
	}

	function requireSweepConfig(): SweepOptions {
		if (!config.sweep)
			throw new Error('createStorage: no `sweep` config was supplied')
		return config.sweep
	}

	function requireVoiceConfig(): StorageKindConfig {
		if (!config.voice)
			throw new Error('createStorage: no `voice` config was supplied')
		return config.voice
	}

	return {
		createImageUploadUrl(userId: string) {
			return createUploadUrl(
				config.image.buildKey(userId),
				config.image.contentType,
			)
		},
		createVoiceUploadUrl(userId: string) {
			const voice = requireVoiceConfig()
			return createUploadUrl(voice.buildKey(userId), voice.contentType)
		},

		// Validates every url in `urls` that doesn't already appear in
		// `existingUrls` — i.e. only what's genuinely new in this request.
		validateNewImages(urls: string[], existingUrls: string[] = []) {
			return guarded(() =>
				validateNewUrls(urls, existingUrls, imageExpectation),
			)
		},
		validateNewImage(
			url: string | null | undefined,
			existingUrl?: string | null,
		) {
			if (!url || url === existingUrl) return Promise.resolve()
			return guarded(() => validateUploadedObject(url, imageExpectation))
		},
		validateNewVoice(
			url: string | null | undefined,
			existingUrl?: string | null,
		) {
			if (!url || url === existingUrl) return Promise.resolve()
			const expectation = toExpectation(requireVoiceConfig(), 'voice message')
			return guarded(() => validateUploadedObject(url, expectation))
		},

		reconcileImage: reconcileOne,
		reconcileImages: reconcileMany,

		sweep() {
			return runSweep(requireSweepConfig())
		},
	}
}
