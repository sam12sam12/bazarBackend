import { eq } from 'drizzle-orm'
import { db } from '../db/db'
import { categories, categoryAttribute } from '../db/schema'
import { contentVersionService } from './contentVersionService'

export const categoryService = {
	/**
	 * The entire catalogue in one payload: every active category (flat, with
	 * `parent_id`/`path`/`depth` so the client can build the tree) plus every
	 * attribute grouped by category, plus the current version so the client can
	 * store tree + version atomically. `name` stays as raw `{ en, ps, fa }` so a
	 * single cached payload serves all languages.
	 */
	async getTree() {
		const [cats, attrs, version] = await Promise.all([
			db
				.select({
					id: categories.id,
					name: categories.name,
					parent_id: categories.parent_id,
					path: categories.path,
					depth: categories.depth,
					icon_url: categories.icon_url,
					sort_order: categories.sort_order,
					is_popular: categories.is_popular,
				})
				.from(categories)
				.where(eq(categories.is_active, true))
				.orderBy(categories.depth, categories.sort_order),
			db
				.select({
					id: categoryAttribute.id,
					category_id: categoryAttribute.category_id,
					code: categoryAttribute.code,
					label: categoryAttribute.label,
					type: categoryAttribute.type,
					placeholder: categoryAttribute.placeholder,
					menu_data: categoryAttribute.menu_data,
					sort_order: categoryAttribute.sort_order,
				})
				.from(categoryAttribute)
				.innerJoin(categories, eq(categoryAttribute.category_id, categories.id))
				.where(eq(categories.is_active, true))
				.orderBy(categoryAttribute.category_id, categoryAttribute.sort_order),
			contentVersionService.getVersion(),
		])

		const attributesByCategory: Record<number, typeof attrs> = {}
		for (const attr of attrs) {
			;(attributesByCategory[attr.category_id] ??= []).push(attr)
		}

		return { version, categories: cats, attributesByCategory }
	},
}
