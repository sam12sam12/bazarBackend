// Append this whole block to the end of db/validation.ts (or wherever that
// project keeps its drizzle-zod schemas). Requires `z` and the `messages`
// table already imported the way the rest of that file does.

// ==================== UPLOADS ====================
// `kind` picks which R2 key prefix/content-type `utils/storage/instance.ts`'s `storage`
// signs for (see its comment) — defaults to `'image'` so existing product/store photo
// callers (which predate `kind` existing at all) keep working unchanged.
export const presignUploadSchema = z
	.object({
		kind: z.enum(['image', 'voice']).default('image'),
	})
	.strict()

// ==================== CHAT ====================
// `sender_id`/`conversation_id` are never in the body — sender comes from
// the authenticated session (see middlewares/authMiddleware.ts, the first
// endpoint family in this project that actually has one), conversation
// comes from the URL or is resolved server-side from `recipient_id`. This
// is also used to validate a WebSocket `message:send` payload, not just a
// REST body — see wsRouter.ts.
//
// Three `kind`-literal variants rather than one shape with every field
// optional — a text message can't carry `images`, an image message's
// `content` is an optional caption rather than the required field it is for
// text, and a voice message has no `content` at all. Mirrors
// `messages_text_content_valid`/`_image_content_valid`/`_voice_content_valid`
// in chatSchema.ts — those CHECKs are the DB backstop behind this.
const sendMessageBaseFields = {
	conversation_id: z.number().int().positive().optional(),
	recipient_id: z.string().uuid().optional(),
	client_id: z.string().min(1).max(100),
}

export const sendTextMessageSchema = z
	.object({
		kind: z.literal('text'),
		content: z.string().trim().min(1).max(2000),
		...sendMessageBaseFields,
	})
	.strict()

export const sendImageMessageSchema = z
	.object({
		kind: z.literal('image'),
		images: z.array(z.string().url()).min(1).max(4),
		content: z.string().trim().max(2000).optional(),
		...sendMessageBaseFields,
	})
	.strict()

export const sendVoiceMessageSchema = z
	.object({
		kind: z.literal('voice'),
		audio_url: z.string().url(),
		audio_duration_seconds: z.number().int().min(2).max(300),
		...sendMessageBaseFields,
	})
	.strict()

export const sendMessageSchema = z
	.discriminatedUnion('kind', [sendTextMessageSchema, sendImageMessageSchema, sendVoiceMessageSchema])
	.refine((data) => data.conversation_id != null || data.recipient_id != null, {
		message: 'Either conversation_id or recipient_id is required',
		path: ['conversation_id'],
	})

// ==================== TYPES (append alongside this project's existing type exports) ====================
export type SendMessage = z.infer<typeof sendMessageSchema>
export type PresignUpload = z.infer<typeof presignUploadSchema>
