// ==================== SHARED ====================
export * from './_shared'
export * from './addressSchema'
export * from './authSchema'
export * from './bannerSchema'
export * from './categorySchema'
export * from './chatSchema'
export * from './contentVersionSchema'
export * from './favoriteProductSchema'
export * from './favoriteRequestSchema'
export * from './favoriteStoreSchema'
export * from './notificationPreferenceSchema'
export * from './notificationSchema'
export * from './orderSchema'
export * from './productRequestSchema'
export * from './productSchema'
export * from './productViewSchema'
// ==================== TABLES ====================
export * from './provinceSchema'
export * from './pushTokenSchema'
// ==================== RELATIONS ====================
export * from './relations'
export * from './reportSchema'
export * from './reviewSchema'
export * from './storeFollowSchema'
export * from './storeSchema'
export * from './storeViewSchema'
export * from './trendingSearchSchema'
export * from './userSchema'

import type { addresses } from './addressSchema'
// ==================== TYPES ====================
import type { categories, categoryAttribute } from './categorySchema'
import type {
	conversation_participants,
	conversations,
	messages,
} from './chatSchema'
import type { contentVersion } from './contentVersionSchema'
import type { favoriteProducts } from './favoriteProductSchema'
import type { favoriteRequests } from './favoriteRequestSchema'
import type { favoriteStores } from './favoriteStoreSchema'
import type { notificationPreferences } from './notificationPreferenceSchema'
import type { notifications } from './notificationSchema'
import type { orderItems, orders } from './orderSchema'
import type { productRequests } from './productRequestSchema'
import type { products } from './productSchema'
import type { productViews } from './productViewSchema'
import type { pushTokens } from './pushTokenSchema'
import type { reports } from './reportSchema'
import type { productReviews, storeReviews } from './reviewSchema'
import type { storeFollows } from './storeFollowSchema'
import type { stores } from './storeSchema'
import type { storeViews } from './storeViewSchema'
import type { trendingSearches } from './trendingSearchSchema'
import type { users } from './userSchema'

export type Category = typeof categories.$inferSelect
export type ContentVersion = typeof contentVersion.$inferSelect
export type User = typeof users.$inferSelect
export type Store = typeof stores.$inferSelect
export type CategoryAttribute = typeof categoryAttribute.$inferSelect
export type Product = typeof products.$inferSelect
export type ProductRequest = typeof productRequests.$inferSelect
export type Address = typeof addresses.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type ProductReview = typeof productReviews.$inferSelect
export type StoreReview = typeof storeReviews.$inferSelect
export type Report = typeof reports.$inferSelect
export type StoreFollow = typeof storeFollows.$inferSelect
export type ProductView = typeof productViews.$inferSelect
export type StoreView = typeof storeViews.$inferSelect
export type FavoriteProduct = typeof favoriteProducts.$inferSelect
export type FavoriteStore = typeof favoriteStores.$inferSelect
export type FavoriteRequest = typeof favoriteRequests.$inferSelect
export type TrendingSearch = typeof trendingSearches.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type ConversationParticipant =
	typeof conversation_participants.$inferSelect
export type Message = typeof messages.$inferSelect
export type PushToken = typeof pushTokens.$inferSelect
export type NotificationPreference = typeof notificationPreferences.$inferSelect
