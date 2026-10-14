import { customType, pgEnum, timestamp } from 'drizzle-orm/pg-core'

// ==================== ENUMS (best practice for type safety) ====================
export const roleEnum = pgEnum('role', ['buyer', 'seller', 'admin'] as const)

export const businessTypeEnum = pgEnum('business_type', [
	'individual',
	'company',
	'real_estate_agent',
	'vehicle_dealer',
] as const)

export const approvalStatusEnum = pgEnum('approval_status', [
	'pending',
	'approved',
	'rejected',
] as const)

export const reviewReactionEnum = pgEnum('review_reaction', [
	'like',
	'dislike',
] as const)

export const productConditionEnum = pgEnum('product_condition', [
	'new',
	'like_new',
	'used',
	'refurbished',
] as const)

export const listingStatusEnum = pgEnum('listing_status', [
	'draft',
	'active',
	'sold',
	'expired',
	'removed',
] as const)

export const currencyEnum = pgEnum('currency', ['AFN', 'USD', 'PKR'] as const)

export const addressTypeEnum = pgEnum('address_type', [
	'home',
	'work',
	'other',
] as const)

// ==================== ORDER ENUMS ====================
export const orderStatusEnum = pgEnum('order_status', [
	'pending',
	'confirmed',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'returned',
] as const)

export const paymentMethodEnum = pgEnum('payment_method', [
	'cash_on_delivery',
	'bank_transfer',
] as const)

export const paymentStatusEnum = pgEnum('payment_status', [
	'unpaid',
	'paid',
	'refunded',
] as const)

export const bannerTypeEnum = pgEnum('banner_type', [
	'product', // links to a specific product (real estate, vehicle, etc.)
	'category',
	'store',
	'external', // Facebook page, website, promotional landing page
])

// ==================== TRENDING SEARCHES ====================
export const searchTargetEnum = pgEnum('search_target', [
	'product',
	'store',
] as const)

// Custom ltree type
export const ltree = customType<{ data: string }>({
	dataType: () => 'ltree',
})

// -----------------------------
// ENUM for notification types (add more as needed)
export const reportReasonEnum = pgEnum('report_reason', [
	'spam',
	'inappropriate',
	'fraud',
	'illegal',
	'other',
	'scam',
	'impersonation',
	'fakeProducts',
	'duplicate',
	'harassment',
	'inappropriateProfile',
] as const)

export const reportStatusEnum = pgEnum('report_status', [
	'pending',
	'resolved',
	'dismissed',
] as const)

export const reportTypeEnum = pgEnum('report_type', [
	'product',
	'store',
	'request',
	'user',
] as const)

// ==================== PRODUCT REQUEST ("wanted ad") ENUM ====================
export const productRequestStatusEnum = pgEnum('product_request_status', [
	'open',
	'resolved',
	'closed',
] as const)

export const notificationTypeEnum = pgEnum('notification_type', [
	'new_follower', // someone followed you
	'new_message', // new chat message
	'new_similar_product', // new listing in a category you follow
	'new_store_product', // a store the user follows added a new product ← store-follow notification
	'bid_received', // someone bid on your vehicle/real-estate
	'offer_accepted', // your offer was accepted
	'new_order', // a buyer placed an order in your store
	'order_status_changed', // shipped, delivered, cancelled…
	'review_received',
	'report_received', // Admin notification for reports
	'admin_broadcast', // Admin announcement to all users or a segment
])

export const pushPlatformEnum = pgEnum('push_platform', [
	'ios',
	'android',
] as const)

export const timestamps = {
	created_at: timestamp('created_at', { withTimezone: true })
		.defaultNow()
		.notNull(),
	updated_at: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => new Date()),
}
