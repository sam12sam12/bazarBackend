import { isNotNull } from 'drizzle-orm'
import type { Context } from 'hono'
import { db } from '../../db/db'
import { messages, products, stores, users } from '../../db/schema'
import { ApiError } from '../ApiError'
import { keyFromPublicUrl } from './client'
import { createStorage } from './createStorage'

// ──────────────────────────────────────────────────────────────────────────
// THE ONE FILE YOU REWRITE PER PROJECT.
//
// Everything else in this folder (client.ts, engine.ts, createStorage.ts,
// index.ts) is a generic, framework-agnostic engine with zero knowledge of
// any specific app — copy it into a new project unchanged. This file is the
// opposite: it's 100% this app's own policy (Hono, Drizzle, `products`/
// `stores`/`users`, `ApiError`) layered on top via `createStorage`.
// ──────────────────────────────────────────────────────────────────────────

interface ProductImage {
	url: string
	sort_order: number
	is_primary: boolean
}

// Every url this database currently references, reduced to R2 keys —
// `keyFromPublicUrl` already excludes anything that isn't one of our own
// objects (seed placeholders, etc.), so those never show up as "referenced"
// or "orphaned" either; they're simply not R2's problem.
async function getReferencedKeys(): Promise<Set<string>> {
	const [userRows, storeRows, productRows, messageRows] = await Promise.all([
		db
			.select({ avatar_url: users.avatar_url })
			.from(users)
			.where(isNotNull(users.avatar_url)),
		db
			.select({ logo_url: stores.logo_url, banner_url: stores.banner_url })
			.from(stores),
		db.select({ images: products.images }).from(products),
		db
			.select({ images: messages.images, audio_url: messages.audio_url })
			.from(messages),
	])

	const referenced = new Set<string>()
	for (const { avatar_url } of userRows) {
		const key = keyFromPublicUrl(avatar_url!)
		if (key) referenced.add(key)
	}
	for (const { logo_url, banner_url } of storeRows) {
		for (const url of [logo_url, banner_url]) {
			if (!url) continue
			const key = keyFromPublicUrl(url)
			if (key) referenced.add(key)
		}
	}
	for (const { images } of productRows) {
		for (const image of images as ProductImage[]) {
			const key = keyFromPublicUrl(image.url)
			if (key) referenced.add(key)
		}
	}
	for (const { images, audio_url } of messageRows) {
		for (const url of [...(images ?? []), audio_url]) {
			if (!url) continue
			const key = keyFromPublicUrl(url)
			if (key) referenced.add(key)
		}
	}
	return referenced
}

export const storage = createStorage({
	image: {
		// The client's pick/compress pipeline only ever emits one exact JPEG
		// content type, under this app's own control end to end — an exact
		// match is meaningful here.
		contentType: 'image/jpeg',
		maxBytes: 8 * 1024 * 1024, // 8 MB
		// Keyed by the uploading user's id, not by the product/store/user the
		// image will end up attached to — a brand-new product/store doesn't
		// have an id yet at upload time (the client uploads first, then
		// creates/updates the row with the URL already in hand). Scoping the
		// key to the uploader's own id is also the whole security model here:
		// nothing else about this upload is checked server-side, so a user
		// being unable to even construct another user's key is what stops
		// them from overwriting someone else's object. `.jpg`, not `.jpeg` —
		// explicit on purpose, matches the client's own pipeline.
		buildKey: (userId) => `images/${userId}/${crypto.randomUUID()}.jpg`,
	},
	voice: {
		// Must match exactly what the client's recorder PUTs — see
		// `frontend`'s voice-upload hook for the current pinned value. Pinned
		// to `audio/m4a` to match the recorder's explicit `.m4a` extension (see
		// useVoiceRecorder.ts) — without that explicit extension on both
		// platforms, the recorded file actually came out MIME-typed as
		// `video/mp4` by the OS, which the previous `audio/mp4` value here was
		// (incorrectly) matching against.
		contentType: 'audio/m4a',
		// ~10 min at 128kbps mono, comfortably above the 10 min cap already
		// enforced by `sendVoiceMessageSchema`'s duration limit.
		maxBytes: 10 * 1024 * 1024,
		buildKey: (userId) => `voices/${userId}/${crypto.randomUUID()}.m4a`,
	},
	sweep: {
		getReferencedKeys,
		prefix: 'images/',
		// Why this is a grace period, not an immediate sweep: see
		// `engine.ts`'s `SweepOptions` comment. 24h.
		gracePeriodMs: 24 * 60 * 60 * 1000,
	},
	// `createStorage`'s validation engine throws a plain `Error` — it has no
	// opinion on any one project's error-handling convention. This is the
	// one place that translates a validation failure into this app's
	// `ApiError` convention (a 400, same as any other bad request).
	onValidationError: (message) => {
		throw ApiError.badRequest(message)
	},
})

// The one HTTP-facing piece of this app's storage integration. Mounted
// directly as `uploadRouter.ts`'s route handler — there's no separate
// `controllers/uploadController.ts` for something this thin.
export async function presignUpload(c: Context) {
	const user = c.get('user') as { id: string }
	const { kind } = c.get('validated') as { kind: 'image' | 'voice' }
	const { uploadUrl, publicUrl } =
		kind === 'voice'
			? await storage.createVoiceUploadUrl(user.id)
			: await storage.createImageUploadUrl(user.id)
	return c.json({
		success: true,
		data: { upload_url: uploadUrl, public_url: publicUrl },
	})
}
