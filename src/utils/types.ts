import type { CursorData } from './pagination'

export type UserId = string

export interface ProductImage {
	url: string
	sort_order: number
	is_primary: boolean
}

export type ReportType = 'product' | 'store' | 'request' | 'user'
export type ReportReason =
	| 'spam'
	| 'inappropriate'
	| 'fraud'
	| 'illegal'
	| 'other'

export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export type ReviewReaction = 'like' | 'dislike'

export type ListingStatus = 'draft' | 'active' | 'sold' | 'expired' | 'removed'
export type ProductCondition = 'new' | 'like_new' | 'used' | 'refurbished'
export const PRODUCT_CONDITION_VALUES: ProductCondition[] = [
	'new',
	'like_new',
	'used',
	'refurbished',
]

export type ProductSort =
	| 'relevance'
	| 'price_asc'
	| 'price_desc'
	| 'rating_desc'

export interface ProductFilters {
	store_id?: number
	category_id?: number
	/** ltree path of a category subtree — matches that category + all descendants */
	category_path?: string
	/** multiple category subtrees (OR'd) — the browse filter's multi-select
	 * department chips, each entry a department's own ltree path */
	category_paths?: string[]
	province_ids?: number[]
	condition?: ProductCondition
	listing_status?: ListingStatus
	min_price?: string
	max_price?: string
	/** minimum discount %, matched against products.off_percentage */
	min_discount?: number
	featured?: boolean
	search?: string
	sort?: ProductSort
	limit?: number
	cursor?: CursorData
	/** category-attribute facets, keyed by `category_attribute.code` (e.g.
	 * "ram", "brand") — each value array is OR'd against whatever's stored
	 * in `products.specifications->code`, regardless of whether that
	 * attribute is itself `multiple` on create (a buyer picking "RAM: 6GB,
	 * 8GB" wants either, not a literal match of a two-value set). Only
	 * meaningful for `type: "menu"` attributes. */
	specs?: Record<string, string[]>
	/** category-attribute numeric ranges, same keying as `specs` — for
	 * `type: "number"` attributes (year, mileage, bedrooms, ...). Either
	 * bound may be omitted for an open-ended range. */
	spec_ranges?: Record<string, { min?: number; max?: number }>
}

export type PublicRequestSort = 'newest' | 'budget_asc' | 'budget_desc'

export interface PublicRequestFilters {
	categoryIds?: number[]
	provinceIds?: number[]
	conditions?: ProductCondition[]
	minBudget?: string
	maxBudget?: string
	search?: string
	sortBy?: PublicRequestSort
}

export type StoreSort =
	| 'relevance'
	| 'rating_desc'
	| 'followers_desc'
	| 'products_desc'

export interface StoreFilters {
	category_id?: number
	/** multiple category subtrees (OR'd) — a store's own `path` mirrors its
	 * category's ltree path, so this matches directly against `stores.path`
	 * with no join needed (unlike products, which need a `categories` join). */
	category_paths?: string[]
	province_id?: number
	province_ids?: number[]
	min_rating?: string
	/** "verified" == approval_status = 'approved' */
	verified_only?: boolean
	search?: string
	sort?: StoreSort
	limit?: number
	cursor?: CursorData
}

export type ReviewSort = 'newest' | 'helpful'

export interface ReviewFilters {
	/** exact star rating, 1-5 */
	rating?: number
	sort?: ReviewSort
}
