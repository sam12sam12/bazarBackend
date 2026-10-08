// ==================== SHARED ====================
export * from "./_shared";
// ==================== TABLES ====================
export * from "./userSchema";
export * from "./authSchema";
export * from "./exampleSchema";

// Add every new domain schema's `export * from "./xSchema"` line here —
// this barrel (not the individual files) is what drizzle.config.ts points
// at, and what auth.ts's `drizzleAdapter(db, { schema })` and db.ts's
// `relations.ts` both read from.

// ==================== TYPES ====================
import type { users } from "./userSchema";
import type { items } from "./exampleSchema";

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
