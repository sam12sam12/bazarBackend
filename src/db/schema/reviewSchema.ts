import { sql } from 'drizzle-orm'
import {
	bigint,
	bigserial,
	boolean,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'
import { reviewReactionEnum, timestamps } from './_shared'
import { products } from './productSchema'
import { stores } from './storeSchema'
import { users } from './userSchema'

// ==================== PRODUCT REVIEWS ====================
export const productReviews = pgTable(
	'product_reviews',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		product_id: bigint('product_id', { mode: 'number' }).notNull(),

		rating: integer('rating').notNull(), // 1 to 5
		comment: text('comment'),
		images: jsonb('images').default(sql`'[]'::jsonb`).notNull(),

		// The reviewed product's store owner's reply — set only via the
		// dedicated reply endpoint, never through the review's own create/update.
		owner_reply: text('owner_reply'),
		owner_reply_at: timestamp('owner_reply_at', { withTimezone: true }),

		// Kept in sync by the reaction toggle endpoint (recalculated from
		// product_review_reactions).
		like_count: integer('like_count').default(0).notNull(),
		dislike_count: integer('dislike_count').default(0).notNull(),

		is_active: boolean('is_active').default(true).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'product_reviews_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.product_id],
			foreignColumns: [products.id],
			name: 'product_reviews_product_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// Unique review per user/product
		uniqueIndex('product_reviews_user_product_idx').on(
			table.product_id,
			table.user_id,
		),

		// Product reviews pagination
		index('product_reviews_pagination_idx').on(
			table.product_id,
			table.created_at.desc(),
			table.id.desc(),
		),
	],
)

// ==================== PRODUCT REVIEW REACTIONS ====================
// One like/dislike per user per review — liking clears a prior dislike (and
// vice versa); sending the same reaction again clears it back to neutral.
export const productReviewReactions = pgTable(
	'product_review_reactions',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		review_id: bigint('review_id', { mode: 'number' }).notNull(),
		reaction: reviewReactionEnum('reaction').notNull(),

		reacted_at: timestamp('reacted_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'product_review_reactions_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.review_id],
			foreignColumns: [productReviews.id],
			name: 'product_review_reactions_review_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// One reaction per user per review
		uniqueIndex('product_review_reactions_review_user_idx').on(
			table.review_id,
			table.user_id,
		),
	],
)

// ==================== STORE REVIEWS ====================
export const storeReviews = pgTable(
	'store_reviews',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		store_id: bigint('store_id', { mode: 'number' }).notNull(),

		rating: integer('rating').notNull(), // 1 to 5
		comment: text('comment'),
		images: jsonb('images').default(sql`'[]'::jsonb`).notNull(),

		// The store owner's reply — set only via the dedicated reply endpoint,
		// never through the review's own create/update.
		owner_reply: text('owner_reply'),
		owner_reply_at: timestamp('owner_reply_at', { withTimezone: true }),

		// Kept in sync by the reaction toggle endpoint (recalculated from
		// store_review_reactions).
		like_count: integer('like_count').default(0).notNull(),
		dislike_count: integer('dislike_count').default(0).notNull(),

		is_active: boolean('is_active').default(true).notNull(),

		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'store_reviews_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.store_id],
			foreignColumns: [stores.id],
			name: 'store_reviews_store_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		uniqueIndex('store_reviews_user_store_idx').on(
			table.store_id,
			table.user_id,
		),

		index('store_reviews_pagination_idx').on(
			table.store_id,
			table.created_at.desc(),
			table.id.desc(),
		),
	],
)

// ==================== STORE REVIEW REACTIONS ====================
// One like/dislike per user per review — same semantics as product review
// reactions above.
export const storeReviewReactions = pgTable(
	'store_review_reactions',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		user_id: uuid('user_id').notNull(),
		review_id: bigint('review_id', { mode: 'number' }).notNull(),
		reaction: reviewReactionEnum('reaction').notNull(),

		reacted_at: timestamp('reacted_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.user_id],
			foreignColumns: [users.id],
			name: 'store_review_reactions_user_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		foreignKey({
			columns: [table.review_id],
			foreignColumns: [storeReviews.id],
			name: 'store_review_reactions_review_id_fkey',
		})
			.onDelete('cascade')
			.onUpdate('cascade'),

		// One reaction per user per review
		uniqueIndex('store_review_reactions_review_user_idx').on(
			table.review_id,
			table.user_id,
		),
	],
)
