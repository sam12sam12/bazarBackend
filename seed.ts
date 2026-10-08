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
	categories,
	categoryAttribute,
	provinces,
	trendingSearches,
} from './src/db/schema'

// ==================== MAIN ====================
async function main() {
	console.log('🚀 Starting full database seed...')
	// await resetDatabase()
	// await db.insert(provinces).values(provincesSeedData)
	// await db.insert(categories).values(categorySeedData)
	// await db.insert(categoryAttribute).values(categoryAttributeSeedData)
	// await db.insert(trendingSearches).values(trendingSearchesSeedData)

	// await seedUsersFakerData(1000)
	// await generateAddressesFakerData(100)
	// await generateStoresFakerData(100)
	// await generateProductsFakerData(1000)
	// await generateProductViewsFakerData()
	// await generateStoreViewsFakerData()
	// await generateProductRequestsFakerData(1000)

	// Orders depend on products + addresses; this generator inserts orders and
	// their items itself (parent/child), so it is not wrapped in db.insert().
	await generateOrdersFakerData(30)

	// await generateNotificationsFakerData()
	// await generateProductReviewsFakerData(1000)
	// await generateStoreReviewsFakerData(1000)
	// await generateBannersFakerData()
	// await generateReportsFakerData(30)
	// await generateProductRequestsFakerData(20)

	console.log('🎉 ALL SEEDING COMPLETED SUCCESSFULLY!')
}

main().catch((err) => {
	console.error('❌ Seed failed:', err)
	process.exit(1)
})

// async function resetDatabase() {
// 	await db.execute(
// 		sql`TRUNCATE TABLE "session", "account", "order_items", "orders", "products", "category_attribute", "stores", "categories", "users", "provinces", "addresses", "banners", "notifications", "product_reviews", "store_reviews" RESTART IDENTITY CASCADE`,
// 	)
// }
