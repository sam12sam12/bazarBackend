import { generateAddressesFakerData } from "./seedData/addresses";
import { generateBannersFakerData } from "./seedData/banners";
import {
  categoryAttributeSeedData,
  categorySeedData,
} from "./seedData/categories";
import { generateNotificationsFakerData } from "./seedData/notifications";
import { generateOrdersFakerData } from "./seedData/orders";
import { generateProductRequestsFakerData } from "./seedData/productRequests";
import { generateProductsFakerData } from "./seedData/products";
import { generateProductViewsFakerData } from "./seedData/productViews";
import { provincesSeedData } from "./seedData/provinces";
import { generateReportsFakerData } from "./seedData/reports";
import {
  generateProductReviewsFakerData,
  generateStoreReviewsFakerData,
} from "./seedData/reviews";
import { generateStoresFakerData } from "./seedData/stores";
import { generateStoreViewsFakerData } from "./seedData/storeViews";
import { trendingSearchesSeedData } from "./seedData/trendingSearches";
import { seedUsersFakerData } from "./seedData/users";
import { sql } from "drizzle-orm";
import { db } from "./src/db/db";
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
} from "./src/db/schema";

// Each step only inserts if its table is still empty, so re-running this
// script is a no-op for steps that already ran — safe to run again after a
// partial failure instead of hand-tracking what already happened.
async function runStep(
  label: string,
  table: { id?: unknown },
  seed: () => Promise<unknown>
) {
  const [existing] = await db
    .select()
    .from(table as never)
    .limit(1);
  if (existing) {
    console.log(`⏭️  ${label}: already seeded, skipping`);
    return;
  }
  console.log(`⏳ ${label}...`);
  await seed();
  console.log(`✅ ${label} done`);
}

// Wipes every seed-reachable table (plus anything that FKs onto
// users/stores/products, pulled in automatically by TRUNCATE ... CASCADE —
// chat, favorites, push tokens, review reactions, auth sessions) so a
// reseed starts from a truly empty slate instead of skipping already-
// populated tables via `runStep`'s guard.
async function resetDatabase() {
  console.log("🧹 Resetting database...");
  await db.execute(
    sql`TRUNCATE TABLE
      "session", "account", "verification",
      "users", "provinces", "categories", "category_attribute",
      "stores", "products", "addresses",
      "orders", "order_items",
      "product_views", "store_views", "product_requests",
      "notifications", "product_reviews", "store_reviews",
      "banners", "reports", "trending_searches"
    RESTART IDENTITY CASCADE`
  );
  console.log("✅ Database reset");
}

// ==================== MAIN ====================
async function main() {
  console.log("🚀 Starting full database seed...");

  await resetDatabase();

  // 1. Base lookup data — no dependencies.
  await runStep("provinces", provinces, () =>
    db.insert(provinces).values(provincesSeedData)
  );
  await runStep("categories", categories, () =>
    db.insert(categories).values(categorySeedData)
  );
  await runStep("category attributes", categoryAttribute, () =>
    db.insert(categoryAttribute).values(categoryAttributeSeedData)
  );
  await runStep("trending searches", trendingSearches, () =>
    db.insert(trendingSearches).values(trendingSearchesSeedData)
  );

  // 2. Users — no dependencies.
  await runStep("users", users, () => seedUsersFakerData(500));

  // 3. Depends on users (+provinces/categories).
  await runStep("addresses", addresses, () => generateAddressesFakerData());
  await runStep("stores", stores, () => generateStoresFakerData(300));

  // 4. Depends on stores.
  await runStep("products", products, () => generateProductsFakerData(10_000));

  // 5. Depends on users + products/stores — view generators have no count
  // param and self-dedupe on (user, target) pairs, but still only run once.
  await runStep("product views", productViews, generateProductViewsFakerData);
  await runStep("store views", storeViews, generateStoreViewsFakerData);

  await runStep("product requests", productRequests, () =>
    generateProductRequestsFakerData(300)
  );

  // 6. Orders depend on products + addresses; the generator inserts orders
  // and their items itself (parent/child), so it isn't wrapped in db.insert().
  await runStep("orders", orders, () => generateOrdersFakerData(800));

  await runStep("notifications", notifications, () =>
    generateNotificationsFakerData(300)
  );
  await runStep("product reviews", productReviews, () =>
    generateProductReviewsFakerData(2000)
  );
  await runStep("store reviews", storeReviews, () =>
    generateStoreReviewsFakerData(600)
  );
  await runStep("banners", banners, generateBannersFakerData);
  await runStep("reports", reports, () => generateReportsFakerData(150));

  console.log("🎉 ALL SEEDING COMPLETED SUCCESSFULLY!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
