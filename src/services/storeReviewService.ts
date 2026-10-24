import { and, desc, eq, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { storeReviewReactions, storeReviews, stores } from '../db/schema'
import type { InsertStoreReview, UpdateStoreReview } from '../db/validation'
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
		.update(storeReviews)
		.set({
			like_count: sql`(SELECT COUNT(*)::int FROM store_review_reactions WHERE review_id = ${reviewId} AND reaction = 'like')`,
			dislike_count: sql`(SELECT COUNT(*)::int FROM store_review_reactions WHERE review_id = ${reviewId} AND reaction = 'dislike')`,
		})
		.where(eq(storeReviews.id, reviewId))
}

// Fetches the review and ensures the caller wrote it (or is an admin).
async function assertOwnerOrAdmin(
	id: number,
	userId: string,
	isAdmin: boolean,
) {
	const review = await db.query.storeReviews.findFirst({
		where: eq(storeReviews.id, id),
		columns: { id: true, user_id: true, store_id: true },
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

export const storeReviewService = {
	async getAll(
		store_id: number,
		limit: number,
		cursor?: CursorData,
		currentUserId?: string,
		filters?: ReviewFilters,
	) {
		const conditions: SQL[] = [eq(storeReviews.store_id, store_id)]
		if (filters?.rating) {
			conditions.push(eq(storeReviews.rating, filters.rating))
		}

		const withRelations = {
			user: { columns: { id: true, name: true, avatar_url: true } as const },
			...(currentUserId
				? {
						reactions: {
							where: eq(storeReviewReactions.user_id, currentUserId),
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
			const helpfulRank = sql`${storeReviews.like_count} - ${storeReviews.dislike_count}`

			const results = await db.query.storeReviews.findMany({
				where: and(...conditions),
				with: withRelations,
				orderBy: [desc(helpfulRank), desc(storeReviews.id)],
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
			? and(...conditions, buildCursorFilter(storeReviews, cursor))
			: and(...conditions)

		const results = await db.query.storeReviews.findMany({
			where: whereCondition,
			with: withRelations,
			orderBy: [desc(storeReviews.created_at), desc(storeReviews.id)],
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

	async getSummary(storeId: number) {
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
			.from(storeReviews)
			.where(eq(storeReviews.store_id, storeId))
		if (!row) return row
		const { count_5, count_4, count_3, count_2, count_1, ...rest } = row
		return { ...rest, breakdown: [count_5, count_4, count_3, count_2, count_1] }
	},

	async getById(id: number, currentUserId?: string) {
		const review = await db.query.storeReviews.findFirst({
			where: eq(storeReviews.id, id),
			with: {
				user: {
					columns: { id: true, name: true, avatar_url: true },
				},
				...(currentUserId
					? {
							reactions: {
								where: eq(storeReviewReactions.user_id, currentUserId),
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
	async create(userId: string, data: InsertStoreReview, reviewerName: string) {
		await storage.validateNewImages(data.images ?? [])

		const [inserted] = await db
			.insert(storeReviews)
			.values({ ...data, user_id: userId })
			.returning({ id: storeReviews.id })
		if (!inserted) return undefined

		// Notify the store owner in the background — never blocks the response.
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, data.store_id),
			columns: { owner_id: true, name: true },
		})
		if (store && store.owner_id !== userId) {
			const body = `${reviewerName} left a ${data.rating}-star review on "${store.name}"`
			notificationDispatchService
				.notifyUsers({
					type: 'review_received',
					recipients: [store.owner_id],
					actorId: userId,
					data: {
						title: 'New Review',
						body,
						store_name: store.name,
						rating: data.rating,
					},
					push: { title: 'New Review', body },
				})
				.catch((err) =>
					console.error(
						'[notification] failed to notify store owner of review:',
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
		data: UpdateStoreReview,
	) {
		await assertOwnerOrAdmin(id, userId, isAdmin)

		const previous = data.images
			? await db.query.storeReviews.findFirst({
					where: eq(storeReviews.id, id),
					columns: { images: true },
				})
			: undefined
		const previousUrls = previous?.images as string[] | undefined

		if (data.images) {
			await storage.validateNewImages(data.images, previousUrls ?? [])
		}

		await db.update(storeReviews).set(data).where(eq(storeReviews.id, id))

		if (data.images) {
			await storage.reconcileImages(previousUrls, data.images)
		}
		return this.getById(id, userId)
	},

	async delete(id: number, userId: string, isAdmin: boolean) {
		await assertOwnerOrAdmin(id, userId, isAdmin)
		const review = await db.query.storeReviews.findFirst({
			where: eq(storeReviews.id, id),
			columns: { images: true },
		})
		await db.delete(storeReviews).where(eq(storeReviews.id, id))
		if (review) {
			await storage.reconcileImages(review.images as string[], [])
		}
		return 'Review deleted successfully'
	},

	// Only the reviewed store's owner (or an admin) may reply.
	// `ownerReply: null` removes an existing reply (the dedicated "Remove
	// reply" menu action), clearing the timestamp alongside it so a removed
	// reply doesn't linger with a stale `owner_reply_at`.
	async reply(
		id: number,
		userId: string,
		isAdmin: boolean,
		ownerReply: string | null,
	) {
		const review = await db.query.storeReviews.findFirst({
			where: eq(storeReviews.id, id),
			columns: { id: true },
			with: { store: { columns: { owner_id: true } } },
		})
		if (!review) throw ApiError.notFound('Review not found')
		if (!isAdmin && review.store.owner_id !== userId) {
			throw ApiError.forbidden()
		}

		await db
			.update(storeReviews)
			.set({
				owner_reply: ownerReply,
				owner_reply_at: ownerReply ? new Date() : null,
			})
			.where(eq(storeReviews.id, id))
		// Same reasoning as create/update — fully hydrated instead of the
		// raw row `.returning()` would give. `userId` here is the replying
		// store owner, so `isOwner`/`my_reaction` correctly reflect theirs.
		return this.getById(id, userId)
	},

	// Toggle the signed-in user's like/dislike on a review — sending the same
	// reaction again clears it back to neutral; sending the other one swaps it.
	async react(id: number, userId: string, reaction: ReviewReaction) {
		const review = await db.query.storeReviews.findFirst({
			where: eq(storeReviews.id, id),
			columns: { id: true },
		})
		if (!review) throw ApiError.notFound('Review not found')

		const existing = await db.query.storeReviewReactions.findFirst({
			where: and(
				eq(storeReviewReactions.review_id, id),
				eq(storeReviewReactions.user_id, userId),
			),
		})

		if (existing?.reaction === reaction) {
			await db
				.delete(storeReviewReactions)
				.where(eq(storeReviewReactions.id, existing.id))
		} else if (existing) {
			await db
				.update(storeReviewReactions)
				.set({ reaction })
				.where(eq(storeReviewReactions.id, existing.id))
		} else {
			await db
				.insert(storeReviewReactions)
				.values({ review_id: id, user_id: userId, reaction })
		}

		await recalculateReactionCounts(id)
		return storeReviewService.getById(id, userId)
	},
}
