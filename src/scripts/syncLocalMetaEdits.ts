// Full resync: overwrites every categories/category_attribute/provinces row
// to match Bazar56/src/Stores/localMetaData.ts (the single source of truth
// for local edits), then bumps content_version so every client refetches.
//
// This is an upsert-by-id "reseed", not a delete-then-insert one — products,
// stores, product_requests, addresses, banners, and users all have foreign
// keys straight to categories.id/provinces.id, so actually deleting and
// recreating those rows would either violate those FKs outright or (worse)
// cascade-delete real user data. Since localMetaData.ts's rows carry the
// exact same ids as the live DB (it started life as a `GET /meta` snapshot),
// upserting by id achieves the same "every row's content now matches the
// local file" result without touching any id other tables depend on.
//
//   bun run sync-meta-edits
//
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { db } from '../db/db'
import { categories, categoryAttribute, provinces } from '../db/schema'
import { contentVersionService } from '../services/contentVersionService'

const LOCAL_META_PATH = join(
	import.meta.dir,
	'../../../Bazar56/src/Stores/localMetaData.ts',
)

function loadLocalMetaData() {
	const src = readFileSync(LOCAL_META_PATH, 'utf8')
	const marker = 'export const localMetaData: MetaBundleResponse = '
	const idx = src.indexOf(marker)
	if (idx === -1) {
		throw new Error(`Could not find "${marker}" in ${LOCAL_META_PATH}`)
	}
	let objStr = src.slice(idx + marker.length).trim()
	if (objStr.endsWith(';')) objStr = objStr.slice(0, -1)

	type LocalMeta = {
		categories: (typeof categories.$inferInsert)[]
		attributesByCategory: Record<
			string,
			(typeof categoryAttribute.$inferInsert)[]
		>
		provinces: (typeof provinces.$inferInsert)[]
	}
	// biome-ignore lint/security/noGlobalEval: trusted local source file, one-off dev script
	return eval(`(${objStr})`) as LocalMeta
}

const data = loadLocalMetaData()

await db.transaction(async (tx) => {
	const sortedCategories = [...data.categories].sort(
		(a, b) => (a.depth ?? 0) - (b.depth ?? 0),
	)
	for (const cat of sortedCategories) {
		await tx
			.insert(categories)
			.values(cat)
			.onConflictDoUpdate({ target: categories.id, set: cat })
	}
	console.log(`Synced ${sortedCategories.length} categor(ies).`)

	const allAttrs = Object.values(data.attributesByCategory).flat()
	for (const attr of allAttrs) {
		await tx
			.insert(categoryAttribute)
			.values(attr)
			.onConflictDoUpdate({ target: categoryAttribute.id, set: attr })
	}
	console.log(`Synced ${allAttrs.length} category attribute(s).`)

	for (const province of data.provinces) {
		await tx
			.insert(provinces)
			.values(province)
			.onConflictDoUpdate({ target: provinces.id, set: province })
	}
	console.log(`Synced ${data.provinces.length} province(s).`)

	// Keep the categories.id sequence ahead of the highest id we just
	// upserted, in case it was ever out of step with explicit-id inserts.
	await tx.execute(
		sql`SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories))`,
	)
	await tx.execute(
		sql`SELECT setval(pg_get_serial_sequence('category_attribute', 'id'), (SELECT MAX(id) FROM category_attribute))`,
	)
	await tx.execute(
		sql`SELECT setval(pg_get_serial_sequence('provinces', 'id'), (SELECT MAX(id) FROM provinces))`,
	)

	await contentVersionService.bumpVersion(tx)
})

const newVersion = await contentVersionService.getVersion()
console.log(`content_version is now ${newVersion}.`)
process.exit(0)
