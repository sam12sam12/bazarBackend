import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { banners } from '../db/schema'
import type { InsertBanner, UpdateBanner } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'

export const bannerService = {
	async getAll(limit: number, cursor?: CursorData) {
		const activeFilter = eq(banners.is_active, true)
		const whereCondition = cursor
			? and(activeFilter, buildCursorFilter(banners, cursor))
			: activeFilter

		const results = await db.query.banners.findMany({
			where: whereCondition,
			with: {
				store: {
					columns: { name: true, logo_url: true },
				},
				product: {
					columns: { title: true, images: true },
				},
				category: {
					columns: { name: true },
				},
			},
			orderBy: [desc(banners.created_at), desc(banners.id)],
			limit: limit + 1,
		})

		const {
			list: bannerList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { banners: bannerList, nextCursor, hasMore }
	},

	async getById(id: number) {
		return db.query.banners.findFirst({
			where: eq(banners.id, id),
			with: {
				store: true,
				product: true,
				category: true,
			},
		})
	},

	async create(data: InsertBanner) {
		await db.insert(banners).values(data)
		return true
	},

	async update(id: number, data: UpdateBanner) {
		await db.update(banners).set(data).where(eq(banners.id, id))
		return true
	},

	async delete(id: number) {
		await db.delete(banners).where(eq(banners.id, id))
		return true
	},
}
