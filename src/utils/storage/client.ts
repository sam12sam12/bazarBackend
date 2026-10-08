import { AwsClient } from 'aws4fetch'

// aws4fetch, not @aws-sdk/client-s3 — R2's own docs recommend it
// specifically for this (https://developers.cloudflare.com/r2/examples/aws/aws4fetch):
// it's a ~1kb client built on fetch + WebCrypto with zero Node-specific
// dependencies, versus pulling in the full AWS SDK's dependency tree just
// to sign one PUT URL. `service`/`region` below are required by the signing
// algorithm's shape but not actually used by R2 itself. Everything in this
// file is deliberately app-agnostic — it knows about R2/S3, not about any
// particular project's tables, content types, or key-naming conventions
// (that's `instance.ts`'s job) — so this whole `utils/storage/` folder can
// move to a new project unchanged, with only the env vars below pointed at
// that project's bucket.
const r2Client = new AwsClient({
	service: 's3',
	region: 'auto',
	accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
})

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const PRESIGN_EXPIRY_SECONDS = 300

// A presigned PUT URL, scoped to one exact key, expiring in 5 minutes —
// long enough for the client to immediately follow up with the actual
// upload, short enough that a leaked URL isn't a standing liability.
// `signQuery: true` embeds the signature as query params (the right mode
// for a URL a client uses directly, vs. header-based signing which needs
// the signer and the requester to be the same process). `contentType` is
// pinned into the signature — the caller must already know exactly what
// bytes it's about to upload, since there's nothing to negotiate at this
// layer; the client's PUT must send the identical header or R2 rejects it
// as a signature mismatch.
export async function createPresignedUploadUrl(
	key: string,
	contentType: string,
): Promise<string> {
	const url = new URL(`${R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`)
	url.searchParams.set('X-Amz-Expires', String(PRESIGN_EXPIRY_SECONDS))

	const signed = await r2Client.sign(
		new Request(url.toString(), {
			method: 'PUT',
			headers: { 'Content-Type': contentType },
		}),
		{ aws: { signQuery: true } },
	)
	return signed.url.toString()
}

// The permanent, public URL an uploaded object is served from once the
// client's PUT succeeds — this is what a caller persists, never the
// presigned URL (which expires).
export function publicUrlFor(key: string): string {
	return `${process.env.R2_PUBLIC_BASE_URL}/${key}`
}

// The inverse of `publicUrlFor` — recovers the object key this backend
// itself issued from a stored public URL, so a later edit/replace can clean
// up the old object. Returns `undefined` for anything that isn't one of our
// own R2 public URLs (seed/placeholder URLs, or any other external URL a
// row might hold) — deliberately conservative, since callers use this to
// decide what's safe to delete.
export function keyFromPublicUrl(url: string): string | undefined {
	const base = `${process.env.R2_PUBLIC_BASE_URL}/`
	if (!url.startsWith(base)) return undefined
	const key = url.slice(base.length)
	return key.length > 0 ? key : undefined
}

// Deletes one object from the bucket. R2's S3-compatible DELETE is
// idempotent (a missing key still returns 204), so there's no "not found"
// case worth distinguishing from "already gone" — both are success from the
// caller's perspective.
export async function deleteObject(key: string): Promise<void> {
	const url = `${R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`
	const response = await r2Client.fetch(url, { method: 'DELETE' })
	if (!response.ok) {
		throw new Error(`R2 delete failed for ${key}: ${response.status}`)
	}
}

// Reads an object's actual `Content-Type`/`Content-Length` without
// downloading its body — the one way to find out what a client's presigned
// PUT actually sent, since the signature only pinned the header it
// *claimed* it would send. Returns `undefined` for a missing object (e.g. a
// client asked for a presign and never finished the upload) rather than
// throwing, since "not uploaded yet" is an expected, not exceptional,
// outcome here.
export async function headObject(
	key: string,
): Promise<
	{ contentType: string | null; contentLength: number | null } | undefined
> {
	const url = `${R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`
	const response = await r2Client.fetch(url, { method: 'HEAD' })
	if (response.status === 404) return undefined
	if (!response.ok) {
		throw new Error(`R2 head failed for ${key}: ${response.status}`)
	}

	const contentLength = response.headers.get('content-length')
	return {
		contentType: response.headers.get('content-type'),
		contentLength: contentLength ? Number(contentLength) : null,
	}
}

// Lists every object under `prefix` with its last-modified time — used only
// by the orphan sweep (see `engine.ts`'s `sweep`), never on a request path.
// `aws4fetch` has no XML parsing built in (it's deliberately just a signing
// fetch client, see the comment above), so this parses the S3
// `ListObjectsV2` response with targeted regexes rather than pulling in a
// full XML parser dependency for one call site — safe here because R2's
// response shape is fixed and never contains attacker-controlled markup
// (object keys are always server-generated, see `instance.ts`).
export async function listObjects(
	prefix: string,
): Promise<{ key: string; lastModified: Date }[]> {
	const results: { key: string; lastModified: Date }[] = []
	let continuationToken: string | undefined

	do {
		const url = new URL(`${R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}`)
		url.searchParams.set('list-type', '2')
		url.searchParams.set('prefix', prefix)
		url.searchParams.set('max-keys', '1000')
		if (continuationToken)
			url.searchParams.set('continuation-token', continuationToken)

		const response = await r2Client.fetch(url.toString())
		if (!response.ok) {
			throw new Error(
				`R2 list failed for prefix "${prefix}": ${response.status}`,
			)
		}
		const xml = await response.text()

		for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
			const key = match[1]?.match(/<Key>([\s\S]*?)<\/Key>/)?.[1]
			const lastModified = match[1]?.match(
				/<LastModified>([\s\S]*?)<\/LastModified>/,
			)?.[1]
			if (key && lastModified) {
				results.push({
					key: key.replace(/&amp;/g, '&'),
					lastModified: new Date(lastModified),
				})
			}
		}

		const isTruncated =
			xml.match(/<IsTruncated>([\s\S]*?)<\/IsTruncated>/)?.[1] === 'true'
		continuationToken = isTruncated
			? xml.match(
					/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/,
				)?.[1]
			: undefined
	} while (continuationToken)

	return results
}
