import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { favoriteProducts, products } from '../db/schema'
import { ApiError } from '../utils/ApiError'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { PRODUCT_LIST_COLUMNS } from './productService'

export const favoriteProductService = {
	async toggle(userId: string, productId: number) {
		const product = await db.query.products.findFirst({
			where: eq(products.id, productId),
			columns: { id: true },
		})
		if (!product) throw ApiError.notFound('Product not found')

		const existing = await db.query.favoriteProducts.findFirst({
			where: and(
				eq(favoriteProducts.user_id, userId),
				eq(favoriteProducts.product_id, productId),
			),
		})

		if (existing) {
			await db
				.delete(favoriteProducts)
				.where(
					and(
						eq(favoriteProducts.user_id, userId),
						eq(favoriteProducts.product_id, productId),
					),
				)
			await db
				.update(products)
				.set({
					favorite_count: sql`GREATEST(${products.favorite_count} - 1, 0)`,
				})
				.where(eq(products.id, productId))
			return { id: productId, favorited: false }
		}

		await db
			.insert(favoriteProducts)
			.values({ user_id: userId, product_id: productId })
			.onConflictDoNothing()
		await db
			.update(products)
			.set({ favorite_count: sql`${products.favorite_count} + 1` })
			.where(eq(products.id, productId))
		return { id: productId, favorited: true }
	},

	async getIds(userId: string): Promise<number[]> {
		const rows = await db
			.select({ product_id: favoriteProducts.product_id })
			.from(favoriteProducts)
			.where(eq(favoriteProducts.user_id, userId))
		return rows.map((r) => r.product_id)
	},

	async isFavorited(userId: string, productId: number): Promise<boolean> {
		const existing = await db.query.favoriteProducts.findFirst({
			where: and(
				eq(favoriteProducts.user_id, userId),
				eq(favoriteProducts.product_id, productId),
			),
			columns: { id: true },
		})
		return !!existing
	},

	async getFavorites(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(favoriteProducts.user_id, userId)
		const cursorFilter = cursor
			? buildCursorFilter(
					{
						created_at: favoriteProducts.favorited_at,
						id: favoriteProducts.product_id,
					},
					cursor,
				)
			: undefined

		const rows = await db
			.select({
				...PRODUCT_LIST_COLUMNS,
				favorited_at: favoriteProducts.favorited_at,
			})
			.from(favoriteProducts)
			.innerJoin(products, eq(favoriteProducts.product_id, products.id))
			.where(and(baseFilter, cursorFilter, eq(products.is_active, true)))
			.orderBy(
				desc(favoriteProducts.favorited_at),
				desc(favoriteProducts.product_id),
			)
			.limit(limit + 1)

		const { list, nextCursor } = paginateResults(
			rows.map((r) => ({ ...r, created_at: r.favorited_at })),
			limit,
		)
		return { products: list, nextCursor }
	},
}
