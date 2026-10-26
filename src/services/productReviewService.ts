import { and, desc, eq, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { productReviewReactions, productReviews, products } from '../db/schema'
import type { InsertProductReview, UpdateProductReview } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { storage } from '../utils/storage/instance'
import type { ReviewFilters, ReviewReaction } from '../utils/types'
import { notificationDispatchService } from './notificationDispatchService'

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

	// Returns the fully hydrated review (same shape as getById, with
	// reviewer name/avatar + my_reaction/isOwner) instead of a bare message
	// — the frontend writes this straight into its caches instead of
	// refetching. Same pattern `react()` below already uses.
	async create(
		userId: string,
		data: InsertProductReview,
		reviewerName: string,
	) {
		await storage.validateNewImages(data.images ?? [])

		const [inserted] = await db
			.insert(productReviews)
			.values({ ...data, user_id: userId })
			.returning({ id: productReviews.id })
		if (!inserted) return undefined

		// Notify the product's store owner in the background — never blocks
		// the response.
		const product = await db.query.products.findFirst({
			where: eq(products.id, data.product_id),
			columns: { title: true, store_id: true },
			with: { store: { columns: { owner_id: true } } },
		})
		if (product && product.store.owner_id !== userId) {
			const body = `${reviewerName} left a ${data.rating}-star review on "${product.title}"`
			notificationDispatchService
				.notifyUsers({
					type: 'review_received',
					recipients: [product.store.owner_id],
					actorId: userId,
					productId: data.product_id,
					data: {
						title: 'New Review',
						body,
						product_title: product.title,
						rating: data.rating,
					},
					push: { title: 'New Review', body },
				})
				.catch((err) =>
					console.error(
						'[notification] failed to notify product owner of review:',
						err,
					),
				)
		}

		return this.getById(inserted.id, userId)
	},

	// Same reasoning as create.
	async update(
		id: number,
		userId: string,
		isAdmin: boolean,
		data: UpdateProductReview,
	) {
		await assertOwnerOrAdmin(id, userId, isAdmin)

		const previous = data.images
			? await db.query.productReviews.findFirst({
					where: eq(productReviews.id, id),
					columns: { images: true },
				})
			: undefined
		const previousUrls = previous?.images as string[] | undefined

		if (data.images) {
			await storage.validateNewImages(data.images, previousUrls ?? [])
		}

		await db.update(productReviews).set(data).where(eq(productReviews.id, id))

		if (data.images) {
			await storage.reconcileImages(previousUrls, data.images)
		}
		return this.getById(id, userId)
	},

	async delete(id: number, userId: string, isAdmin: boolean) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		const review = await db.query.productReviews.findFirst({
			where: eq(productReviews.id, id),
			columns: { images: true },
		})
		await db.delete(productReviews).where(eq(productReviews.id, id))
		if (review) {
			await storage.reconcileImages(review.images as string[], [])
		}
		return 'Review deleted successfully'
	},

	// The reviewed product's store owner replying to a review — only that
	// store's owner (or an admin) may do this. `ownerReply: null` removes an
	// existing reply (the dedicated "Remove reply" menu action), clearing
	// the timestamp alongside it so a removed reply doesn't linger with a
	// stale `owner_reply_at`.
	async reply(
		id: number,
		userId: string,
		isAdmin: boolean,
		ownerReply: string | null,
	) {
		const review = await db.query.productReviews.findFirst({
			where: eq(productReviews.id, id),
			columns: { id: true, user_id: true },
			with: {
				product: {
					columns: { id: true, title: true },
					with: { store: { columns: { owner_id: true } } },
				},
			},
		})
		if (!review) throw ApiError.notFound('Review not found')
		if (!isAdmin && review.product.store.owner_id !== userId) {
			throw ApiError.forbidden()
		}

		await db
			.update(productReviews)
			.set({
				owner_reply: ownerReply,
				owner_reply_at: ownerReply ? new Date() : null,
			})
			.where(eq(productReviews.id, id))

		// Notify the original reviewer that their review got a reply — only
		// for an actual new/edited reply, not the "remove reply" action, and
		// never self-notify if the store owner reviewed their own product.
		// In-app only for now, same v1 posture as new_similar_product/
		// bid_received/offer_accepted (no push category wired up yet).
		if (ownerReply && review.user_id !== userId) {
			notificationDispatchService
				.notifyUsers({
					type: 'review_reply',
					recipients: [review.user_id],
					actorId: userId,
					productId: review.product.id,
					data: {
						title: 'New Reply',
						body: `The seller replied to your review on "${review.product.title}"`,
						product_title: review.product.title,
					},
				})
				.catch((err) =>
					console.error(
						'[notification] failed to notify reviewer of reply:',
						err,
					),
				)
		}

		// Same reasoning as create/update — fully hydrated instead of the
		// raw row `.returning()` would give (no reviewer name/avatar, no
		// my_reaction/isOwner). `userId` here is the replying store owner,
		// so `isOwner`/`my_reaction` correctly reflect their own viewpoint.
		return this.getById(id, userId)
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
