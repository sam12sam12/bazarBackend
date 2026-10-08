import { and, desc, eq, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { productReviewReactions, productReviews } from '../db/schema'
import type { InsertProductReview, UpdateProductReview } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import type { ReviewFilters, ReviewReaction } from '../utils/types'

async function recalculateReactionCounts(reviewId: number) {
	await db
		.update(productReviews)
		.set({
			like_count: sql`(SELECT COUNT(*)::int FROM product_review_reactions WHERE review_id = ${reviewId} AND reaction = 'like')`,
			dislike_count: sql`(SELECT COUNT(*)::int FROM product_review_reactions WHERE review_id = ${reviewId} AND reaction = 'dislike')`,
		})
		.where(eq(productReviews.id, reviewId))
}

// Fetches the review and ensures the caller wrote it (or is an admin).
async function assertOwnerOrAdmin(
	id: number,
	userId: string,
	isAdmin: boolean,
) {
	const review = await db.query.productReviews.findFirst({
		where: eq(productReviews.id, id),
		columns: { id: true, user_id: true, product_id: true },
	})
	if (!review) throw ApiError.notFound('Review not found')
	if (!isAdmin && review.user_id !== userId) throw ApiError.forbidden()
	return review
}

// Attaches `my_reaction` from the (at most one) reaction row belonging to
// the given user, and `isOwner` (whether the given user wrote this review),
// and drops the raw `reactions` relation from the output.
function withMyReaction<
	T extends { reactions?: { reaction: ReviewReaction }[]; user_id: string },
>(review: T, currentUserId?: string) {
	const { reactions, ...rest } = review
	return {
		...rest,
		my_reaction: reactions?.[0]?.reaction ?? null,
		isOwner: currentUserId ? review.user_id === currentUserId : false,
	}
}

export const productReviewService = {
	async getAll(
		productId: number,
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
		filters?: ReviewFilters,
	) {
		const conditions: SQL[] = [eq(productReviews.product_id, productId)]
		if (filters?.rating) {
			conditions.push(eq(productReviews.rating, filters.rating))
		}

		const withRelations = {
			user: { columns: { id: true, name: true, avatar_url: true } as const },
			...(currentUserId
				? {
						reactions: {
							where: eq(productReviewReactions.user_id, currentUserId),
							columns: { reaction: true } as const,
						},
					}
				: {}),
		}

		// "helpful" orders by a value the shared (created_at, id) cursor knows
		// nothing about, so — same trick as products/stores — it pages by
		// plain offset instead (carried in cursor.id).
		if (filters?.sort === 'helpful') {
			const offset = cursor ? Number(cursor.id) : 0
			const helpfulRank = sql`${productReviews.like_count} - ${productReviews.dislike_count}`

			const results = await db.query.productReviews.findMany({
				where: and(...conditions),
				with: withRelations,
				orderBy: [desc(helpfulRank), desc(productReviews.id)],
				limit: limit + 1,
				offset,
			})

			const hasMore = results.length > limit
			const reviewList = hasMore ? results.slice(0, limit) : results
			const nextCursor = hasMore
				? { created_at: new Date().toISOString(), id: offset + limit }
				: null
			return {
				reviews: reviewList.map((r) => withMyReaction(r, currentUserId)),
				nextCursor,
				hasMore,
			}
		}

		const whereCondition = cursor
			? and(...conditions, buildCursorFilter(productReviews, cursor))
			: and(...conditions)

		const results = await db.query.productReviews.findMany({
			where: whereCondition,
			with: withRelations,
			orderBy: [desc(productReviews.created_at), desc(productReviews.id)],
			limit: limit + 1,
		})

		const {
			list: reviewList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return {
			reviews: reviewList.map((r) => withMyReaction(r, currentUserId)),
			nextCursor,
			hasMore,
		}
	},

	async getSummary(productId: number) {
		const [row] = await db
			.select({
				count: sql<number>`COUNT(*)::int`,
				average_rating: sql<number>`COALESCE(ROUND(AVG(rating)::numeric, 2), 0)`,
				count_5: sql<number>`COUNT(*) FILTER (WHERE rating = 5)::int`,
				count_4: sql<number>`COUNT(*) FILTER (WHERE rating = 4)::int`,
				count_3: sql<number>`COUNT(*) FILTER (WHERE rating = 3)::int`,
				count_2: sql<number>`COUNT(*) FILTER (WHERE rating = 2)::int`,
				count_1: sql<number>`COUNT(*) FILTER (WHERE rating = 1)::int`,
			})
			.from(productReviews)
			.where(eq(productReviews.product_id, productId))
		if (!row) return row
		const { count_5, count_4, count_3, count_2, count_1, ...rest } = row
		return { ...rest, breakdown: [count_5, count_4, count_3, count_2, count_1] }
	},

	async getById(id: number, currentUserId?: string) {
		const review = await db.query.productReviews.findFirst({
			where: eq(productReviews.id, id),
			with: {
				user: {
					columns: { id: true, name: true, avatar_url: true },
				},
				...(currentUserId
					? {
							reactions: {
								where: eq(productReviewReactions.user_id, currentUserId),
								columns: { reaction: true },
							},
						}
					: {}),
			},
		})
		return review ? withMyReaction(review, currentUserId) : undefined
	},

	async create(userId: string, data: InsertProductReview) {
		try {
			await db.insert(productReviews).values({ ...data, user_id: userId })
		} catch (error) {
			// unique_violation — this user already reviewed this product
			if ((error as { code?: string }).code === '23505') {
				throw ApiError.conflict('You have already reviewed this product')
			}
			throw error
		}
		return 'Review created successfully'
	},

	async update(
		id: number,
		userId: string,
		isAdmin: boolean,
		data: UpdateProductReview,
	) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		await db.update(productReviews).set(data).where(eq(productReviews.id, id))
		return 'Review updated successfully'
	},

	async delete(id: number, userId: string, isAdmin: boolean) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		await db.delete(productReviews).where(eq(productReviews.id, id))
		return 'Review deleted successfully'
	},

	// The reviewed product's store owner replying to a review — only that
	// store's owner (or an admin) may do this.
	async reply(
		id: number,
		userId: string,
		isAdmin: boolean,
		ownerReply: string,
	) {
		const review = await db.query.productReviews.findFirst({
			where: eq(productReviews.id, id),
			columns: { id: true },
			with: {
				product: {
					columns: { id: true },
					with: { store: { columns: { owner_id: true } } },
				},
			},
		})
		if (!review) throw ApiError.notFound('Review not found')
		if (!isAdmin && review.product.store.owner_id !== userId) {
			throw ApiError.forbidden()
		}

		const [updated] = await db
			.update(productReviews)
			.set({ owner_reply: ownerReply, owner_reply_at: new Date() })
			.where(eq(productReviews.id, id))
			.returning()
		return updated
	},

	// Toggle the signed-in user's like/dislike on a review — sending the same
	// reaction again clears it back to neutral; sending the other one swaps it.
	async react(id: number, userId: string, reaction: ReviewReaction) {
		const review = await db.query.productReviews.findFirst({
			where: eq(productReviews.id, id),
			columns: { id: true },
		})
		if (!review) throw ApiError.notFound('Review not found')

		const existing = await db.query.productReviewReactions.findFirst({
			where: and(
				eq(productReviewReactions.review_id, id),
				eq(productReviewReactions.user_id, userId),
			),
		})

		if (existing?.reaction === reaction) {
			await db
				.delete(productReviewReactions)
				.where(eq(productReviewReactions.id, existing.id))
		} else if (existing) {
			await db
				.update(productReviewReactions)
				.set({ reaction })
				.where(eq(productReviewReactions.id, existing.id))
		} else {
			await db
				.insert(productReviewReactions)
				.values({ review_id: id, user_id: userId, reaction })
		}

		await recalculateReactionCounts(id)
		return productReviewService.getById(id, userId)
	},
}
