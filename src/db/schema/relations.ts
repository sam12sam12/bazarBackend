import { relations } from 'drizzle-orm'
import { addresses } from './addressSchema'
import { account, session } from './authSchema'
import { banners } from './bannerSchema'
import { categories, categoryAttribute } from './categorySchema'
import {
	conversation_participants,
	conversations,
	messages,
} from './chatSchema'
import { favoriteProducts } from './favoriteProductSchema'
import { favoriteRequests } from './favoriteRequestSchema'
import { favoriteStores } from './favoriteStoreSchema'
import { notificationPreferences } from './notificationPreferenceSchema'
import { notifications } from './notificationSchema'
import { orders } from './orderSchema'
import { productRequests } from './productRequestSchema'
import { products } from './productSchema'
import { productViews } from './productViewSchema'
import { provinces } from './provinceSchema'
import { pushTokens } from './pushTokenSchema'
import { reports } from './reportSchema'
import {
	productReviewReactions,
	productReviews,
	storeReviewReactions,
	storeReviews,
} from './reviewSchema'
import { storeFollows } from './storeFollowSchema'
import { stores } from './storeSchema'
import { storeViews } from './storeViewSchema'
import { users } from './userSchema'

// ==================== PROVINCE RELATIONS ====================
export const provincesRelations = relations(provinces, ({ many }) => ({
	users: many(users),
	stores: many(stores),
	products: many(products),
	addresses: many(addresses),
	productRequests: many(productRequests),
}))

// ==================== CATEGORY RELATIONS ====================
export const categoriesRelations = relations(categories, ({ one, many }) => ({
	parent: one(categories, {
		fields: [categories.parent_id],
		references: [categories.id],
		relationName: 'categoryParent',
	}),
	children: many(categories, { relationName: 'categoryParent' }),
	attributes: many(categoryAttribute),
	products: many(products),
	productRequests: many(productRequests),
}))

export const categoryAttributeRelations = relations(
	categoryAttribute,
	({ one }) => ({
		category: one(categories, {
			fields: [categoryAttribute.category_id],
			references: [categories.id],
		}),
	}),
)

// ==================== USER RELATIONS ====================
export const usersRelations = relations(users, ({ one, many }) => ({
	stores: many(stores),
	addresses: many(addresses),
	province: one(provinces, {
		fields: [users.province_id],
		references: [provinces.id],
	}),
	productReviews: many(productReviews),
	storeReviews: many(storeReviews),
	reports: many(reports, { relationName: 'report_author' }),
	reportsAgainstMe: many(reports, { relationName: 'report_target_user' }),
	productRequests: many(productRequests),
	sessions: many(session),
	accounts: many(account),
	// Stores this user follows
	followedStores: many(storeFollows),
	// Products this user has viewed
	viewedProducts: many(productViews),
	// Stores this user has viewed
	viewedStores: many(storeViews),
	// Saved (favorited) items
	favoriteProducts: many(favoriteProducts),
	favoriteStores: many(favoriteStores),
	favoriteRequests: many(favoriteRequests),
	// Orders this user placed as a buyer
	orders: many(orders),
	pushToken: one(pushTokens),
	notificationPreference: one(notificationPreferences),
}))

export const sessionRelations = relations(session, ({ one }) => ({
	users: one(users, {
		fields: [session.user_id],
		references: [users.id],
	}),
}))

export const accountRelations = relations(account, ({ one }) => ({
	users: one(users, {
		fields: [account.user_id],
		references: [users.id],
	}),
}))

// ==================== STORE RELATIONS ====================
export const storesRelations = relations(stores, ({ one, many }) => ({
	owner: one(users, {
		fields: [stores.owner_id],
		references: [users.id],
	}),
	category: one(categories, {
		fields: [stores.category_id],
		references: [categories.id],
	}),
	province: one(provinces, {
		fields: [stores.province_id],
		references: [provinces.id],
	}),
	products: many(products),
	reviews: many(storeReviews),
	reports: many(reports),
	// Users who follow this store
	followers: many(storeFollows),
	// Orders placed in this store
	orders: many(orders),
	views: many(storeViews),
	favoritedBy: many(favoriteStores),
}))

// ==================== PRODUCT RELATIONS ====================
export const productsRelations = relations(products, ({ one, many }) => ({
	store: one(stores, {
		fields: [products.store_id],
		references: [stores.id],
	}),
	category: one(categories, {
		fields: [products.category_id],
		references: [categories.id],
	}),
	province: one(provinces, {
		fields: [products.province_id],
		references: [provinces.id],
	}),
	reviews: many(productReviews),
	reports: many(reports),
	orders: many(orders),
	views: many(productViews),
	favoritedBy: many(favoriteProducts),
}))

// ==================== ADDRESS RELATIONS ====================
export const addressesRelations = relations(addresses, ({ one, many }) => ({
	user: one(users, {
		fields: [addresses.user_id],
		references: [users.id],
	}),
	province: one(provinces, {
		fields: [addresses.province_id],
		references: [provinces.id],
	}),
	orders: many(orders),
}))

// ==================== BANNER RELATIONS ====================
export const bannersRelations = relations(banners, ({ one }) => ({
	product: one(products, {
		fields: [banners.product_id],
		references: [products.id],
	}),
	category: one(categories, {
		fields: [banners.category_id],
		references: [categories.id],
	}),
	store: one(stores, { fields: [banners.store_id], references: [stores.id] }),
	province: one(provinces, {
		fields: [banners.province_id],
		references: [provinces.id],
	}),
}))

// ==================== NOTIFICATION RELATIONS ====================
export const notificationsRelations = relations(notifications, ({ one }) => ({
	user: one(users, {
		fields: [notifications.user_id],
		references: [users.id],
		relationName: 'notificationRecipient',
	}),
	actor: one(users, {
		fields: [notifications.actor_id],
		references: [users.id],
		relationName: 'notificationActor',
	}),
	product: one(products, {
		fields: [notifications.product_id],
		references: [products.id],
	}),
}))

// ==================== PUSH TOKEN RELATIONS ====================
export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
	user: one(users, {
		fields: [pushTokens.user_id],
		references: [users.id],
	}),
}))

// ==================== NOTIFICATION PREFERENCE RELATIONS ====================
export const notificationPreferencesRelations = relations(
	notificationPreferences,
	({ one }) => ({
		user: one(users, {
			fields: [notificationPreferences.user_id],
			references: [users.id],
		}),
	}),
)

// ==================== PRODUCT REVIEW RELATIONS ====================
export const productReviewsRelations = relations(
	productReviews,
	({ one, many }) => ({
		user: one(users, {
			fields: [productReviews.user_id],
			references: [users.id],
		}),
		product: one(products, {
			fields: [productReviews.product_id],
			references: [products.id],
		}),
		reactions: many(productReviewReactions),
	}),
)

export const productReviewReactionsRelations = relations(
	productReviewReactions,
	({ one }) => ({
		user: one(users, {
			fields: [productReviewReactions.user_id],
			references: [users.id],
		}),
		review: one(productReviews, {
			fields: [productReviewReactions.review_id],
			references: [productReviews.id],
		}),
	}),
)

// ==================== STORE REVIEW RELATIONS ====================
export const storeReviewsRelations = relations(
	storeReviews,
	({ one, many }) => ({
		user: one(users, {
			fields: [storeReviews.user_id],
			references: [users.id],
		}),
		store: one(stores, {
			fields: [storeReviews.store_id],
			references: [stores.id],
		}),
		reactions: many(storeReviewReactions),
	}),
)

export const storeReviewReactionsRelations = relations(
	storeReviewReactions,
	({ one }) => ({
		user: one(users, {
			fields: [storeReviewReactions.user_id],
			references: [users.id],
		}),
		review: one(storeReviews, {
			fields: [storeReviewReactions.review_id],
			references: [storeReviews.id],
		}),
	}),
)

// ==================== REPORT RELATIONS ====================
export const reportsRelations = relations(reports, ({ one }) => ({
	user: one(users, {
		fields: [reports.user_id],
		references: [users.id],
		relationName: 'report_author',
	}),
	product: one(products, {
		fields: [reports.product_id],
		references: [products.id],
	}),
	store: one(stores, {
		fields: [reports.store_id],
		references: [stores.id],
	}),
	request: one(productRequests, {
		fields: [reports.request_id],
		references: [productRequests.id],
	}),
	reportedUser: one(users, {
		fields: [reports.reported_user_id],
		references: [users.id],
		relationName: 'report_target_user',
	}),
}))

// ==================== PRODUCT REQUEST RELATIONS ====================
export const productRequestsRelations = relations(
	productRequests,
	({ one, many }) => ({
		user: one(users, {
			fields: [productRequests.user_id],
			references: [users.id],
		}),
		category: one(categories, {
			fields: [productRequests.category_id],
			references: [categories.id],
		}),
		province: one(provinces, {
			fields: [productRequests.province_id],
			references: [provinces.id],
		}),
		favoritedBy: many(favoriteRequests),
		reports: many(reports),
	}),
)

// ==================== STORE FOLLOW RELATIONS ====================
export const storeFollowsRelations = relations(storeFollows, ({ one }) => ({
	user: one(users, {
		fields: [storeFollows.user_id],
		references: [users.id],
	}),
	store: one(stores, {
		fields: [storeFollows.store_id],
		references: [stores.id],
	}),
}))

// ==================== PRODUCT VIEW RELATIONS ====================
export const productViewsRelations = relations(productViews, ({ one }) => ({
	user: one(users, {
		fields: [productViews.user_id],
		references: [users.id],
	}),
	product: one(products, {
		fields: [productViews.product_id],
		references: [products.id],
	}),
}))

// ==================== STORE VIEW RELATIONS ====================
export const storeViewsRelations = relations(storeViews, ({ one }) => ({
	user: one(users, {
		fields: [storeViews.user_id],
		references: [users.id],
	}),
	store: one(stores, {
		fields: [storeViews.store_id],
		references: [stores.id],
	}),
}))

// ==================== FAVORITE PRODUCT RELATIONS ====================
export const favoriteProductsRelations = relations(
	favoriteProducts,
	({ one }) => ({
		user: one(users, {
			fields: [favoriteProducts.user_id],
			references: [users.id],
		}),
		product: one(products, {
			fields: [favoriteProducts.product_id],
			references: [products.id],
		}),
	}),
)

// ==================== FAVORITE STORE RELATIONS ====================
export const favoriteStoresRelations = relations(favoriteStores, ({ one }) => ({
	user: one(users, {
		fields: [favoriteStores.user_id],
		references: [users.id],
	}),
	store: one(stores, {
		fields: [favoriteStores.store_id],
		references: [stores.id],
	}),
}))

// ==================== FAVORITE REQUEST RELATIONS ====================
export const favoriteRequestsRelations = relations(
	favoriteRequests,
	({ one }) => ({
		user: one(users, {
			fields: [favoriteRequests.user_id],
			references: [users.id],
		}),
		request: one(productRequests, {
			fields: [favoriteRequests.request_id],
			references: [productRequests.id],
		}),
	}),
)

// ==================== CHAT RELATIONS ====================
export const conversationsRelations = relations(
	conversations,
	({ one, many }) => ({
		lastMessageSender: one(users, {
			fields: [conversations.last_message_sender_id],
			references: [users.id],
		}),
		participants: many(conversation_participants),
		messages: many(messages),
	}),
)

export const conversationParticipantsRelations = relations(
	conversation_participants,
	({ one }) => ({
		conversation: one(conversations, {
			fields: [conversation_participants.conversation_id],
			references: [conversations.id],
		}),
		user: one(users, {
			fields: [conversation_participants.user_id],
			references: [users.id],
		}),
	}),
)

export const messagesRelations = relations(messages, ({ one }) => ({
	conversation: one(conversations, {
		fields: [messages.conversation_id],
		references: [conversations.id],
	}),
	sender: one(users, {
		fields: [messages.sender_id],
		references: [users.id],
	}),
	referenceProduct: one(products, {
		fields: [messages.reference_product_id],
		references: [products.id],
	}),
	referenceRequest: one(productRequests, {
		fields: [messages.reference_request_id],
		references: [productRequests.id],
	}),
}))

// ==================== ORDER RELATIONS ====================
export const ordersRelations = relations(orders, ({ one }) => ({
	buyer: one(users, {
		fields: [orders.buyer_id],
		references: [users.id],
	}),
	store: one(stores, {
		fields: [orders.store_id],
		references: [stores.id],
	}),
	product: one(products, {
		fields: [orders.product_id],
		references: [products.id],
	}),
	shippingAddress: one(addresses, {
		fields: [orders.shipping_address_id],
		references: [addresses.id],
	}),
}))
