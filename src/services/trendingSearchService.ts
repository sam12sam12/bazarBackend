import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { trendingSearches } from '../db/schema'

export const trendingSearchService = {
	async getByTarget(target: 'product' | 'store') {
		return db.query.trendingSearches.findMany({
			where: and(
				eq(trendingSearches.target, target),
				eq(trendingSearches.is_active, true),
			),
			orderBy: [asc(trendingSearches.sort_order), asc(trendingSearches.id)],
		})
	},
}
