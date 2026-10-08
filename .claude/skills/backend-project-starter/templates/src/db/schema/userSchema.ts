import { boolean, check, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamps } from "./_shared";

// Identity-bearing entity — uuid PK (see backend-architect skill's
// schema-drizzle.md: "PK type follows the entity's role"). Doubles as
// better-auth's "user" model (see auth.ts's `user.modelName: "users"` +
// `fields` mapping) — `email_verified` exists only for that, and `avatar`
// is reused as better-auth's "image" field via the same mapping, so there's
// no separate better-auth-owned user table.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: text("name").notNull(),
    email: text("email").notNull(),
    email_verified: boolean("email_verified").notNull().default(false),
    phone: text("phone"),
    avatar: text("avatar"),

    ...timestamps,
  },
  (table) => [
    // Case-insensitive uniqueness — two signups differing only by case are
    // the same account.
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),

    // Same length-bound discipline as products (see productSchema.ts) — an
    // unbounded `text` column has no ceiling anywhere else in the stack
    // either, since there's no `insertUserSchema` (users are seeded, not
    // signed up; see CLAUDE.md's "Auth — not built yet").
    check("users_name_length", sql`char_length(${table.name}) <= 255`),
    check("users_email_length", sql`char_length(${table.email}) <= 255`),
    check("users_phone_length", sql`${table.phone} IS NULL OR char_length(${table.phone}) <= 32`),
    check("users_avatar_length", sql`${table.avatar} IS NULL OR char_length(${table.avatar}) <= 2048`),
  ],
);
