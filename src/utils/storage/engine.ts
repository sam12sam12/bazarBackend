import {
	createPresignedUploadUrl,
	deleteObject,
	headObject,
	keyFromPublicUrl,
	listObjects,
	publicUrlFor,
} from './client'

// Every operation a caller performs on top of `client.ts`'s raw R2
// primitives: presigning an upload, validating what actually landed,
// cleaning up what a row no longer references, and sweeping up what nothing
// ever referenced at all. One file, not four, because each of these is a
// handful of lines with no internal state or sub-concerns worth isolating —
// splitting them further would be navigation overhead, not clarity.

// ──────────────────────────────────────────────────────────────────────────
// Presign
// ──────────────────────────────────────────────────────────────────────────

export async function createUploadUrl(
	key: string,
	contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
	const uploadUrl = await createPresignedUploadUrl(key, contentType)
	return { uploadUrl, publicUrl: publicUrlFor(key) }
}

// ──────────────────────────────────────────────────────────────────────────
// Validate
// ──────────────────────────────────────────────────────────────────────────

export interface UploadExpectation {
	isAcceptableContentType?: (contentType: string) => boolean
	maxBytes: number
	notFoundMessage: string
	invalidMessage: string
}

// A presigned PUT's signature only pins the `Content-Type` header the
// client *claims* it'll send — nothing stops it from actually PUTting a
// different type or an oversized body, since the storage provider never
// re-checks a signed request's promises against what was really sent. This
// is that re-check, run once against the real object (`headObject`, no body
// download) before its URL is ever allowed to reach a caller's database —
// reject-and-delete here is the one point in an upload flow that can still
// stop an invalid object before it's considered "this app's data." A no-op
// for any url that isn't one of this storage's own objects
// (`keyFromPublicUrl` returns `undefined`) — never validate or delete
// something this backend didn't issue a presigned URL for.
export async function validateUploadedObject(
	url: string,
	expectation: UploadExpectation,
): Promise<void> {
	const key = keyFromPublicUrl(url)
	if (!key) return

	const meta = await headObject(key)
	if (!meta) {
		throw new Error(expectation.notFoundMessage)
	}

	const isValid =
		(!expectation.isAcceptableContentType ||
			(!!meta.contentType &&
				expectation.isAcceptableContentType(meta.contentType))) &&
		meta.contentLength != null &&
		meta.contentLength <= expectation.maxBytes

	if (!isValid) {
		console.error(
			`storage.validate: rejecting ${key} — contentType=${meta.contentType}, contentLength=${meta.contentLength}, maxBytes=${expectation.maxBytes}`,
		)
		await deleteObject(key).catch((error) =>
			console.error(
				`storage.validate: failed to delete invalid object ${key}`,
				error,
			),
		)
		throw new Error(expectation.invalidMessage)
	}
}

// Validates every url in `urls` that doesn't already appear in
// `existingUrls` — i.e. only what's genuinely new in this request, not urls
// a previous write already validated and persisted. Pass `existingUrls: []`
// (or omit it) when every url is always new.
export async function validateNewUrls(
	urls: string[],
	existingUrls: string[],
	expectation: UploadExpectation,
): Promise<void> {
	const existing = new Set(existingUrls)
	const fresh = urls.filter((url) => !existing.has(url))
	await Promise.all(
		fresh.map((url) => validateUploadedObject(url, expectation)),
	)
}

// ──────────────────────────────────────────────────────────────────────────
// Reconcile
// ──────────────────────────────────────────────────────────────────────────

// Deletes whichever object a row no longer points at, once an update has
// already committed. Three cases:
//   - unchanged (same url, or both empty) → no-op, never touch storage.
//   - cleared or replaced → delete the *old* object, since nothing else
//     references it once the row no longer points at it.
//   - old value isn't one of this storage's own objects (seed/placeholder
//     urls, or any other external url) → `keyFromPublicUrl` returns
//     `undefined` and this is skipped — never attempt to delete something
//     this backend didn't upload.
// Deletion failure is logged, not thrown: a dangling object is a minor
// cleanup miss, not a reason to fail the write the caller already made.
export async function reconcileOne(
	previousUrl: string | null | undefined,
	nextUrl: string | null | undefined,
): Promise<void> {
	if (previousUrl === nextUrl || !previousUrl) return

	const staleKey = keyFromPublicUrl(previousUrl)
	if (!staleKey) return

	try {
		await deleteObject(staleKey)
	} catch (error) {
		console.error(
			`storage.reconcile: failed to delete stale object ${staleKey}`,
			error,
		)
	}
}

// The gallery/array counterpart to `reconcileOne` — `nextUrls` is treated as
// a whole-array replace, so "removed" is just set difference: every url in
// `previousUrls` that isn't in `nextUrls` anymore. `undefined` means "the
// update didn't touch this field at all" → skip entirely, same as
// `reconcileOne`'s `previousUrl === nextUrl` no-op case.
export async function reconcileMany(
	previousUrls: string[] | null | undefined,
	nextUrls: string[] | null | undefined,
): Promise<void> {
	if (nextUrls === undefined) return

	const next = new Set(nextUrls)
	const removed = (previousUrls ?? []).filter((url) => !next.has(url))

	await Promise.all(removed.map((url) => reconcileOne(url, null)))
}

// ──────────────────────────────────────────────────────────────────────────
// Sweep
// ──────────────────────────────────────────────────────────────────────────

export interface SweepOptions {
	// The one thing this module can't know on its own: which keys are still
	// referenced by *some* row in *some* table. That's entirely a consuming
	// project's schema — injected as a callback instead of this module
	// importing a specific project's tables directly, which is what makes
	// this file portable across projects instead of merely relocated.
	getReferencedKeys: () => Promise<Set<string>>
	prefix: string
	// Not "anything unreferenced right now" — an object can legitimately
	// exist in storage for a few minutes between a successful upload and its
	// owning create/update request committing. Sweeping on `lastModified` age
	// instead of immediately is what keeps this from racing (and deleting) an
	// object that was just uploaded and is still waiting on its in-flight
	// request.
	gracePeriodMs: number
}

export async function findOrphanedKeys(
	options: SweepOptions,
): Promise<string[]> {
	const [referenced, allObjects] = await Promise.all([
		options.getReferencedKeys(),
		listObjects(options.prefix),
	])

	const cutoff = Date.now() - options.gracePeriodMs
	return allObjects
		.filter(
			(obj) => !referenced.has(obj.key) && obj.lastModified.getTime() < cutoff,
		)
		.map((obj) => obj.key)
}

export async function sweep(
	options: SweepOptions,
): Promise<{ deleted: string[]; failed: string[] }> {
	const orphaned = await findOrphanedKeys(options)
	const deleted: string[] = []
	const failed: string[] = []

	for (const key of orphaned) {
		try {
			await deleteObject(key)
			deleted.push(key)
		} catch (error) {
			console.error(`storage.sweep: failed to delete ${key}`, error)
			failed.push(key)
		}
	}

	return { deleted, failed }
}
