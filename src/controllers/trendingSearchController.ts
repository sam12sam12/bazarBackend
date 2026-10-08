import type { Context } from 'hono'
import { trendingSearchService } from '../services/trendingSearchService'
import { ApiError } from '../utils/ApiError'

export const trendingSearchController = {
	async getAll(c: Context) {
		const target = c.req.query('target')
		if (target !== 'product' && target !== 'store') {
			throw ApiError.badRequest('target must be "product" or "store"')
		}

		const trendingSearches = await trendingSearchService.getByTarget(target)
		return c.json({ success: true, data: trendingSearches })
	},
}
