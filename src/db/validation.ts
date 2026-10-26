import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
	addresses,
	banners,
	categories,
	categoryAttribute,
	notificationPreferences,
	notifications,
	orders,
	productRequests,
	productReviews,
	products,
	provinces,
	pushTokens,
	reports,
	storeReviews,
	stores,
	trendingSearches,
	users,
} from './schema'

// ==================== CUSTOM JSONB SCHEMAS ====================

/**
 * Schema for product images stored in JSONB
 */
export const productImageSchema = z.object({
	url: z.string().url('Invalid image URL'),
	sort_order: z.number().int().default(0),
	is_primary: z.boolean().default(false),
})

export const productImagesArraySchema = z.array(productImageSchema)

/**
 * Body for `POST /uploads/presign`. `kind` defaults to `'image'` so every
 * existing caller (product/store photo uploads) keeps working unchanged;
 * chat voice-note uploads pass `kind: 'voice'` to get a presign scoped to
 * the voice content-type/size policy in `utils/storage/instance.ts`.
 */
export const presignUploadSchema = z
	.object({ kind: z.enum(['image', 'voice']).default('image') })
	.strict()

/**
 * Schema for product specifications stored in JSONB
 * Key-value pairs representing technical details (e.g., color, size, etc.)
 * — a value is a plain scalar for a single-select/number/text attribute, or
 * a string array for a `multiple: true` category attribute (RAM, Storage,
 * Color, ...; see categoryAttribute.multiple).
 */
export const productSpecificationsSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
)

// ==================== USER VALIDATION ====================

export const selectUserSchema = createSelectSchema(users)
export const insertUserSchema = createInsertSchema(users, {
	email: (schema) => schema.email('Invalid email address'),
	phone: (schema) =>
		schema.regex(
			/^\+[1-9]\d{6,14}$/,
			'Invalid phone number (expected E.164 format, e.g. +93701234567)',
		),
	avatar_url: (schema) => schema.url('Invalid image URL').optional(),
}).strict()
export const updateUserSchema = insertUserSchema.partial().strict()

// ==================== CATEGORY VALIDATION ====================

/**
 * Category name translations. All three locales are required.
 */
export const categoryNameSchema = z.object({
	en: z.string().trim().min(1, 'English name is required'),
	ps: z.string().trim().min(1, 'Pashto name is required'),
	fa: z.string().trim().min(1, 'Dari/Farsi name is required'),
})

export const selectCategorySchema = createSelectSchema(categories, {
	name: categoryNameSchema,
})
export const insertCategorySchema = createInsertSchema(categories, {
	name: categoryNameSchema,
	path: () =>
		z
			.string()
			.trim()
			.min(1, 'Path is required')
			.max(100, 'Path must be at most 100 characters')
			.regex(
				/^(\/?[a-z0-9]+(?:-[a-z0-9]+)*)+(\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
				'Path must contain valid path segments',
			),
}).strict()
export const updateCategorySchema = insertCategorySchema.partial().strict()

// ==================== CATEGORY ATTRIBUTE VALIDATION ====================

/**
 * One selectable value inside a `type: "menu"` attribute (e.g. one of
 * RAM's "4GB"/"8GB"/"16GB" choices) — `value` is the machine-stable key,
 * `label` is translated same as everything else.
 */
export const categoryAttributeOptionSchema = z.object({
	value: z.string().trim().min(1, 'Option value is required'),
	label: categoryNameSchema,
})

export const selectCategoryAttributeSchema = createSelectSchema(
	categoryAttribute,
	{
		label: categoryNameSchema,
		placeholder: categoryNameSchema.nullable(),
		menu_data: z.array(categoryAttributeOptionSchema).nullable(),
	},
)
export const insertCategoryAttributeSchema = createInsertSchema(
	categoryAttribute,
	{
		label: categoryNameSchema,
		placeholder: categoryNameSchema.nullable().optional(),
		menu_data: z.array(categoryAttributeOptionSchema).nullable().optional(),
	},
).strict()
export const updateCategoryAttributeSchema = insertCategoryAttributeSchema
	.partial()
	.strict()

// ==================== PROVINCE VALIDATION ====================

/**
 * Province name translations. All three locales are required.
 */
export const provinceNameSchema = z.object({
	en: z.string().trim().min(1, 'English name is required'),
	ps: z.string().trim().min(1, 'Pashto name is required'),
	fa: z.string().trim().min(1, 'Dari/Farsi name is required'),
})

export const selectProvinceSchema = createSelectSchema(provinces, {
	name: provinceNameSchema,
})
export const insertProvinceSchema = createInsertSchema(provinces, {
	name: provinceNameSchema,
}).strict()
export const updateProvinceSchema = insertProvinceSchema.partial().strict()

// ==================== ADDRESS VALIDATION ====================

export const selectAddressSchema = createSelectSchema(addresses)
export const insertAddressSchema = createInsertSchema(addresses, {
	phone: (schema) =>
		schema.regex(
			/^\+[1-9]\d{6,14}$/,
			'Invalid phone number (expected E.164 format, e.g. +93701234567)',
		),
	latitude: z
		.string()
		.regex(/^-?\d+(\.\d+)?$/)
		.optional(),
	longitude: z
		.string()
		.regex(/^-?\d+(\.\d+)?$/)
		.optional(),
}).strict()

/**
 * Client payload for `POST /addresses` — `user_id` comes from the session,
 * never the client, so a request can't create (or, via update below,
 * reassign) an address for someone else.
 */
export const createAddressSchema = insertAddressSchema.omit({ user_id: true })
export const updateAddressSchema = insertAddressSchema
	.omit({ user_id: true })
	.partial()
	.strict()

// ==================== STORE VALIDATION ====================

export const selectStoreSchema = createSelectSchema(stores)

export const insertStoreSchema = createInsertSchema(stores, {
	path: z
		.string()
		.regex(
			/^(\/?[a-z0-9]+(?:-[a-z0-9]+)*)+(\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
			'Path must contain valid slug segments',
		),

	contact_phone: (schema) =>
		schema
			.regex(
				/^\+[1-9]\d{6,14}$/,
				'Invalid phone number (expected E.164 format)',
			)
			.optional(),
	secondary_phone: (schema) =>
		schema
			.regex(
				/^\+[1-9]\d{6,14}$/,
				'Invalid phone number (expected E.164 format)',
			)
			.optional(),
	whatsapp: (schema) =>
		schema
			.regex(
				/^\+[1-9]\d{6,14}$/,
				'Invalid phone number (expected E.164 format)',
			)
			.optional(),
	latitude: z
		.union([
			z.number(),
			z
				.string()
				.regex(/^-?\d+(\.\d+)?$/)
				.transform(Number),
		])
		.nullable()
		.optional(),
	longitude: z
		.union([
			z.number(),
			z
				.string()
				.regex(/^-?\d+(\.\d+)?$/)
				.transform(Number),
		])
		.nullable()
		.optional(),
	logo_url: (schema) => schema.url('Invalid image URL').optional(),
	banner_url: (schema) => schema.url('Invalid image URL').nullable().optional(),
}).strict()

export const updateStoreSchema = insertStoreSchema.partial().strict()

/**
 * Client payload for creating a store. `owner_id` comes from the session and
 * `path` is derived from the chosen category; every performance/approval column
 * is managed server-side.
 */
export const createStoreSchema = insertStoreSchema.omit({
	owner_id: true,
	path: true,
	is_active: true,
	approval_status: true,
	approved_at: true,
	product_count: true,
	featured: true,
})

// ==================== PRODUCT VALIDATION ====================

const deliveryFee = () =>
	z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
		.nullable()
		.optional()

export const selectProductSchema = createSelectSchema(products)
export const insertProductSchema = createInsertSchema(products, {
	price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format'),
	compare_at_price: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
		.nullable()
		.optional(),
	intra_city_fee: deliveryFee(),
	inter_province_fee: deliveryFee(),
	// Overwrite JSONB fields with structured validation
	images: productImagesArraySchema,
	specifications: productSpecificationsSchema,
}).strict()
export const updateProductSchema = insertProductSchema.partial().strict()

/**
 * Client payload for creating/updating a product. `province_id` is set
 * server-side from the listing's store (a product's province is always its
 * store's province — there's no reason to ask the seller to repeat it per
 * listing) — see productController.create/update.
 */
export const createProductSchema = insertProductSchema.omit({
	province_id: true,
})
export type CreateProduct = z.infer<typeof createProductSchema>

// Same `province_id` exclusion as createProductSchema above — if an edit
// changes `store_id`, productController.update re-derives province_id from
// the new store rather than letting the client set it directly.
export const updateProductClientSchema = createProductSchema.partial().strict()
export type UpdateProductClient = z.infer<typeof updateProductClientSchema>

export const removeImageSchema = z.object({
	url: z.string().url('Invalid image URL'),
})

// ==================== BANNER VALIDATION ====================

export const selectBannerSchema = createSelectSchema(banners)
export const insertBannerSchema = createInsertSchema(banners, {
	image_url: (schema) => schema.url('Invalid image URL'),
	link: (schema) => schema.url('Invalid link URL').optional(),
}).strict()
export const updateBannerSchema = insertBannerSchema.partial().strict()

// ==================== TRENDING SEARCH VALIDATION ====================
// Read-only from the API — rows are seeded/managed directly. The insert
// schema exists only to type the seed data, no insert/update route uses it.
export const selectTrendingSearchSchema = createSelectSchema(trendingSearches)
export const insertTrendingSearchSchema = createInsertSchema(trendingSearches)

// ==================== NOTIFICATION VALIDATION ====================

export const selectNotificationSchema = createSelectSchema(notifications)
export const insertNotificationSchema = createInsertSchema(notifications, {
	user_id: (schema) => schema.min(1, 'User ID is required'),
	actor_id: (schema) => schema.min(1, 'Actor ID is required'),
	data: z.record(z.string(), z.any()).default({}),
}).strict()
export const updateNotificationSchema = insertNotificationSchema
	.partial()
	.strict()

// ==================== PUSH TOKEN VALIDATION ====================

export const selectPushTokenSchema = createSelectSchema(pushTokens)
export const insertPushTokenSchema = createInsertSchema(pushTokens, {
	token: (schema) => schema.min(1, 'Token is required'),
})
	.pick({ token: true, platform: true, device_name: true, os_version: true })
	.strict()
// user_id is always set server-side from the session — never trusted from the client.

// ==================== NOTIFICATION PREFERENCE VALIDATION ====================

export const selectNotificationPreferenceSchema = createSelectSchema(
	notificationPreferences,
)
export const updateNotificationPreferenceSchema = createInsertSchema(
	notificationPreferences,
)
	.pick({
		new_store_product: true,
		new_message: true,
		order_status_changed: true,
	})
	.partial()
	.strict()

// ==================== ADMIN BROADCAST VALIDATION ====================

export const adminBroadcastSchema = z
	.object({
		title: z.string().min(1).max(120),
		body: z.string().min(1).max(500),
		segment: z.enum(['all', 'buyers', 'sellers']).default('all'),
		data: z.record(z.string(), z.any()).optional().default({}),
	})
	.strict()

// ==================== PRODUCT REVIEW VALIDATION ====================

export const selectProductReviewSchema = createSelectSchema(productReviews)
const baseProductReviewSchema = createInsertSchema(productReviews, {
	rating: z.number().int().min(1).max(5),
	images: z.array(z.string()).optional().default([]),
}).strict()

/**
 * Client payload for `POST /product-reviews` — `user_id` comes from the
 * session (never the client), `is_active`/`owner_reply`/`owner_reply_at` are
 * moderation/store-owner-only fields set through their own endpoints, and
 * `like_count`/`dislike_count` are maintained by the reaction toggle endpoint.
 */
export const insertProductReviewSchema = baseProductReviewSchema.omit({
	user_id: true,
	is_active: true,
	owner_reply: true,
	owner_reply_at: true,
	like_count: true,
	dislike_count: true,
})
// Editing a review can change the rating/comment/images, never which
// product it's attached to.
export const updateProductReviewSchema = insertProductReviewSchema
	.omit({ product_id: true })
	.partial()
	.strict()

// `null` removes an existing reply (the "Remove reply" menu action).
export const replyProductReviewSchema = z
	.object({ owner_reply: z.string().trim().min(1).max(1000).nullable() })
	.strict()

export const reactToProductReviewSchema = z
	.object({ reaction: z.enum(['like', 'dislike']) })
	.strict()

// ==================== STORE REVIEW VALIDATION ====================

export const selectStoreReviewSchema = createSelectSchema(storeReviews)
const baseStoreReviewSchema = createInsertSchema(storeReviews, {
	rating: z.number().int().min(1).max(5),
	images: z.array(z.string()).optional().default([]),
}).strict()

/**
 * Client payload for `POST /store-reviews` — `user_id` comes from the
 * session (never the client), `is_active`/`owner_reply`/`owner_reply_at` are
 * moderation/store-owner-only fields set through their own endpoints, and
 * `like_count`/`dislike_count` are maintained by the reaction toggle endpoint.
 */
export const insertStoreReviewSchema = baseStoreReviewSchema.omit({
	user_id: true,
	is_active: true,
	owner_reply: true,
	owner_reply_at: true,
	like_count: true,
	dislike_count: true,
})
// Editing a review can change the rating/comment/images, never which
// store it's attached to.
export const updateStoreReviewSchema = insertStoreReviewSchema
	.omit({ store_id: true })
	.partial()
	.strict()

// `null` removes an existing reply (the "Remove reply" menu action).
export const replyStoreReviewSchema = z
	.object({ owner_reply: z.string().trim().min(1).max(1000).nullable() })
	.strict()

export const reactToStoreReviewSchema = z
	.object({ reaction: z.enum(['like', 'dislike']) })
	.strict()

// ==================== REPORT VALIDATION ====================

export const selectReportSchema = createSelectSchema(reports)

/**
 * Client payload for `POST /reports` — `user_id` comes from the session,
 * never the client, so a request can't file a report as someone else.
 * `status` is moderation-only, set server-side.
 */
const baseReportSchema = createInsertSchema(reports)
	.omit({ user_id: true, status: true })
	.strict()

export const insertReportSchema = baseReportSchema.refine(
	(data) => {
		const subjects = [
			data.product_id,
			data.store_id,
			data.request_id,
			data.reported_user_id,
		]
		const providedCount = subjects.filter(
			(value) => value !== undefined && value !== null,
		).length
		if (providedCount !== 1) return false

		switch (data.type) {
			case 'product':
				return data.product_id != null
			case 'store':
				return data.store_id != null
			case 'request':
				return data.request_id != null
			case 'user':
				return data.reported_user_id != null
			default:
				return false
		}
	},
	{
		message:
			'Exactly one of product_id, store_id, request_id, or reported_user_id must be provided, matching `type`.',
		path: ['type'],
	},
)

export const updateReportSchema = createInsertSchema(reports).strict().partial()

// ==================== PRODUCT REQUEST VALIDATION ====================

const budgetSchema = z
	.string()
	.regex(/^\d+(\.\d{1,2})?$/, 'Invalid budget format')
	.nullable()
	.optional()

export const selectProductRequestSchema = createSelectSchema(productRequests)

const baseProductRequestSchema = createInsertSchema(productRequests, {
	budget_min: budgetSchema,
	budget_max: budgetSchema,
	// there's no image upload endpoint yet, so images stays optional and
	// falls back to the column's own '[]' default
	images: productImagesArraySchema.optional(),
	// Required on create (RequestForm's picker has no "any condition"
	// option anymore) — `.partial()` below still makes it optional on
	// update, same as every other field there.
	condition: z.enum(['new', 'like_new', 'used', 'refurbished']),
})
	.omit({ user_id: true, status: true })
	.strict()

export const insertProductRequestSchema = baseProductRequestSchema.refine(
	(data) =>
		!data.budget_min ||
		!data.budget_max ||
		Number(data.budget_max) >= Number(data.budget_min),
	{
		message: 'budget_max must be greater than or equal to budget_min',
		path: ['budget_max'],
	},
)

export const updateProductRequestSchema = baseProductRequestSchema
	.partial()
	.strict()

export const updateRequestStatusSchema = z
	.object({
		status: z.enum(['open', 'resolved', 'closed']),
	})
	.strict()

// ==================== CHAT VALIDATION ====================

const baseSendMessageSchema = z.object({
	recipient_id: z.string().uuid().optional(),
	conversation_id: z.number().int().positive().optional(),
})

export const sendTextMessageSchema = baseSendMessageSchema
	.extend({
		kind: z.literal('text'),
		content: z.string().trim().min(1).max(4000),
	})
	.strict()

export const sendImageMessageSchema = baseSendMessageSchema
	.extend({
		kind: z.literal('image'),
		images: z.array(z.string().url()).min(1).max(10),
		content: z.string().trim().max(4000).optional(),
	})
	.strict()

export const sendVoiceMessageSchema = baseSendMessageSchema
	.extend({
		kind: z.literal('voice'),
		audio_url: z.string().url(),
		audio_duration_seconds: z.number().int().positive().max(600),
	})
	.strict()

// "Share this product/request into the chat" — see chatSchema's own comment
// on `reference_product_id`/`reference_request_id`. chatService.sendMessage
// verifies the referenced row actually exists (same spirit as
// validateAttachments for image/voice) before inserting. `content` is an
// optional caption typed alongside the staged reference (see Bazar56's
// ComposerReferenceSection) — same "optional caption on a non-text kind" as
// sendImageMessageSchema's own `content`.
export const sendProductReferenceMessageSchema = baseSendMessageSchema
	.extend({
		kind: z.literal('product_reference'),
		reference_product_id: z.number().int().positive(),
		content: z.string().trim().max(4000).optional(),
	})
	.strict()

export const sendRequestReferenceMessageSchema = baseSendMessageSchema
	.extend({
		kind: z.literal('request_reference'),
		reference_request_id: z.number().int().positive(),
		content: z.string().trim().max(4000).optional(),
	})
	.strict()

export const sendMessageSchema = z
	.discriminatedUnion('kind', [
		sendTextMessageSchema,
		sendImageMessageSchema,
		sendVoiceMessageSchema,
		sendProductReferenceMessageSchema,
		sendRequestReferenceMessageSchema,
	])
	.refine((data) => data.recipient_id != null || data.conversation_id != null, {
		message: 'Either recipient_id or conversation_id is required',
		path: ['recipient_id'],
	})

// ==================== ORDER VALIDATION ====================

export const selectOrderSchema = createSelectSchema(orders)

export const orderStatusValues = [
	'pending',
	'confirmed',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'returned',
] as const

/**
 * Checkout payload. The server is authoritative for pricing — it re-fetches
 * products and computes totals; only the product id, requested quantity, and
 * which variant was picked are accepted from the client. buyer_id is derived
 * from the authenticated session.
 */
export const checkoutSchema = z
	.object({
		shipping_address_id: z.number().int().positive(),
		payment_method: z.enum(['cash_on_delivery', 'bank_transfer']).optional(),
		buyer_note: z.string().max(500).optional(),
		items: z
			.array(
				z.object({
					product_id: z.number().int().positive(),
					quantity: z.number().int().positive(),
					// Which value the buyer picked per variant attribute (e.g.
					// { color: "navy" }) — two lines for the same product_id with
					// different selected_options are kept as two separate order
					// items, not merged into one with a combined quantity (see
					// ordersService.checkout's line-keying).
					selected_options: z.record(z.string(), z.string()).optional(),
				}),
			)
			.min(1, 'At least one item is required'),
	})
	.strict()

/**
 * Seller updates an order's status. Allowed transitions are enforced in the
 * service (state machine). actor_id is derived from the authenticated session.
 */
export const updateOrderStatusSchema = z
	.object({
		status: z.enum(orderStatusValues),
	})
	.strict()

/**
 * Buyer cancels their own order (only while pending/confirmed).
 * buyer_id is derived from the authenticated session.
 */
export const cancelOrderSchema = z
	.object({
		cancel_reason: z.string().max(300).optional(),
	})
	.strict()

// ==================== TYPE EXPORTS ====================

export type InsertUser = z.infer<typeof insertUserSchema>
export type InsertStore = z.infer<typeof insertStoreSchema>
export type CreateStore = z.infer<typeof createStoreSchema>
export type InsertCategory = z.infer<typeof insertCategorySchema>
export type InsertCategoryAttribute = z.infer<
	typeof insertCategoryAttributeSchema
>
export type InsertProvince = z.infer<typeof insertProvinceSchema>
export type InsertAddress = z.infer<typeof insertAddressSchema>

export type UpdateStore = z.infer<typeof updateStoreSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
export type UpdateCategory = z.infer<typeof updateCategorySchema>
export type UpdateCategoryAttribute = z.infer<
	typeof updateCategoryAttributeSchema
>
export type UpdateProvince = z.infer<typeof updateProvinceSchema>
export type UpdateAddress = z.infer<typeof updateAddressSchema>

export type InsertBanner = z.infer<typeof insertBannerSchema>
export type UpdateBanner = z.infer<typeof updateBannerSchema>

export type InsertTrendingSearch = z.infer<typeof insertTrendingSearchSchema>

export type InsertNotification = z.infer<typeof insertNotificationSchema>
export type UpdateNotification = z.infer<typeof updateNotificationSchema>

export type InsertPushToken = z.infer<typeof insertPushTokenSchema>
export type UpdateNotificationPreference = z.infer<
	typeof updateNotificationPreferenceSchema
>
export type AdminBroadcast = z.infer<typeof adminBroadcastSchema>

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>
export type UpdateProductReview = z.infer<typeof updateProductReviewSchema>

export type InsertStoreReview = z.infer<typeof insertStoreReviewSchema>
export type UpdateStoreReview = z.infer<typeof updateStoreReviewSchema>

export type InsertReport = z.infer<typeof insertReportSchema>
export type UpdateReport = z.infer<typeof updateReportSchema>

export type InsertProductRequest = z.infer<typeof insertProductRequestSchema>
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>

export type SendMessage = z.infer<typeof sendMessageSchema>

export type Checkout = z.infer<typeof checkoutSchema>
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>
export type CancelOrder = z.infer<typeof cancelOrderSchema>
