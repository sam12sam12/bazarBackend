import type { InsertTrendingSearch } from '../src/db/validation'

// Manually curated — not generated from real user search activity. Edit this
// list directly (and re-run the seed, or upsert via Drizzle Studio) to change
// what's shown as trending.
export const trendingSearchesSeedData: InsertTrendingSearch[] = [
	// ── Products ──
	{ target: 'product', term: 'سمارټ موبایل', sort_order: 1, is_active: true },
	{ target: 'product', term: 'بېسیم هیډفون', sort_order: 2, is_active: true },
	{
		target: 'product',
		term: 'نایکي سپورتي بوټان',
		sort_order: 3,
		is_active: true,
	},
	{ target: 'product', term: 'هوښیار ساعت', sort_order: 4, is_active: true },
	{ target: 'product', term: 'لپټاپ کمپیوټر', sort_order: 5, is_active: true },
	{ target: 'product', term: 'ښځینه لاسي بکس', sort_order: 6, is_active: true },

	// ── Stores ──
	{
		target: 'store',
		term: 'کابل سوداګریز مارکېټ',
		sort_order: 1,
		is_active: true,
	},
	{
		target: 'store',
		term: 'کندهار عصري بازار',
		sort_order: 2,
		is_active: true,
	},
	{ target: 'store', term: 'بلخ فیشن سټور', sort_order: 3, is_active: true },
	{
		target: 'store',
		term: 'کندهار عصري بازار مرکز کابل',
		sort_order: 4,
		is_active: true,
	},
]
