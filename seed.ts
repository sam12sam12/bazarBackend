import { generateAddressesFakerData } from './seedData/addresses'
import { generateBannersFakerData } from './seedData/banners'
import {
	categoryAttributeSeedData,
	categorySeedData,
} from './seedData/categories'
import { generateNotificationsFakerData } from './seedData/notifications'
import { generateOrdersFakerData } from './seedData/orders'
import { generateProductRequestsFakerData } from './seedData/productRequests'
import { generateProductsFakerData } from './seedData/products'
import { generateProductViewsFakerData } from './seedData/productViews'
import { provincesSeedData } from './seedData/provinces'
import { generateReportsFakerData } from './seedData/reports'
import {
	generateProductReviewsFakerData,
	generateStoreReviewsFakerData,
} from './seedData/reviews'
import { generateStoresFakerData } from './seedData/stores'
import { generateStoreViewsFakerData } from './seedData/storeViews'
import { trendingSearchesSeedData } from './seedData/trendingSearches'
import { seedUsersFakerData } from './seedData/users'
import { db } from './src/db/db'
import {
	addresses,
	banners,
	categories,
	categoryAttribute,
	notifications,
	orders,
	productRequests,
	productReviews,
	products,
	productViews,
	provinces,
	reports,
	storeReviews,
	stores,
	storeViews,
	trendingSearches,
	users,
} from './src/db/schema'

// Each step only inserts if its table is still empty, so re-running this
// script is a no-op for steps that already ran — safe to run again after a
// partial failure instead of hand-tracking what already happened.
async function runStep(
	label: string,
	table: { id?: unknown },
	seed: () => Promise<unknown>,
) {
	const [existing] = await db.select().from(table as never).limit(1)
	if (existing) {
		console.log(`⏭️  ${label}: already seeded, skipping`)
		return
	}
	console.log(`⏳ ${label}...`)
	await seed()
	console.log(`✅ ${label} done`)
}

// ==================== MAIN ====================
async function main() {
	console.log('🚀 Starting full database seed...')

	// 1. Base lookup data — no dependencies.
	await runStep('provinces', provinces, () =>
		db.insert(provinces).values(provincesSeedData),
	)
	await runStep('categories', categories, () =>
		db.insert(categories).values(categorySeedData),
	)
	await runStep('category attributes', categoryAttribute, () =>
		db.insert(categoryAttribute).values(categoryAttributeSeedData),
	)
	await runStep('trending searches', trendingSearches, () =>
		db.insert(trendingSearches).values(trendingSearchesSeedData),
	)

	// 2. Users — no dependencies.
	await runStep('users', users, () => seedUsersFakerData(150))

	// 3. Depends on users (+provinces/categories).
	await runStep('addresses', addresses, () => generateAddressesFakerData())
	await runStep('stores', stores, () => generateStoresFakerData(60))

	// 4. Depends on stores.
	await runStep('products', products, () => generateProductsFakerData(400))

	// 5. Depends on users + products/stores — view generators have no count
	// param and self-dedupe on (user, target) pairs, but still only run once.
	await runStep('product views', productViews, generateProductViewsFakerData)
	await runStep('store views', storeViews, generateStoreViewsFakerData)

	await runStep('product requests', productRequests, () =>
		generateProductRequestsFakerData(80),
	)

	// 6. Orders depend on products + addresses; the generator inserts orders
	// and their items itself (parent/child), so it isn't wrapped in db.insert().
	await runStep('orders', orders, () => generateOrdersFakerData(120))

	await runStep('notifications', notifications, generateNotificationsFakerData)
	await runStep('product reviews', productReviews, () =>
		generateProductReviewsFakerData(150),
	)
	await runStep('store reviews', storeReviews, () =>
		generateStoreReviewsFakerData(80),
	)
	await runStep('banners', banners, generateBannersFakerData)
	await runStep('reports', reports, () => generateReportsFakerData(40))

	console.log('🎉 ALL SEEDING COMPLETED SUCCESSFULLY!')
}

main()
	.catch((err) => {
		console.error('❌ Seed failed:', err)
		process.exit(1)
	})
	.finally(() => process.exit(0))

// async function resetDatabase() {
// 	await db.execute(
// 		sql`TRUNCATE TABLE "session", "account", "order_items", "orders", "products", "category_attribute", "stores", "categories", "users", "provinces", "addresses", "banners", "notifications", "product_reviews", "store_reviews" RESTART IDENTITY CASCADE`,
// 	)
// }
