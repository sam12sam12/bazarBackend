import { sql } from "drizzle-orm";
import { bigserial, check, foreignKey, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./userSchema";

// ──────────────────────────────────────────────────────────────────────────
// THE ONE EXAMPLE SCHEMA. Not a real business table — a worked, end-to-end
// vertical slice (schema → validation → service → controller → router) that
// proves auth, the DB connection, and every shared middleware/helper all
// wire together correctly in a brand-new project. Delete this file (and
// exampleService.ts/exampleController.ts/exampleRouter.ts, and the
// `items`/`Item` lines in validation.ts/schema/index.ts) once real domain
// tables replace it — nothing else in this starter depends on it.
// ──────────────────────────────────────────────────────────────────────────
export const items = pgTable(
  "items",
  {
    // bigserial, not uuid — this is an owned list resource (see
    // backend-architect skill's "PK type follows the entity's role": uuid
    // for identity-bearing/externally-referenced entities like `users`,
    // bigserial for everything listed/paginated under an owner), the same
    // choice the reference backend makes for `products`.
    id: bigserial("id", { mode: "number" }).primaryKey(),
    user_id: uuid("user_id").notNull(),

    title: text("title").notNull(),
    body: text("body"),

    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
      name: "items_user_id_fkey",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),

    // FK columns aren't auto-indexed by Postgres, and every list query below
    // filters by it.
    index("items_user_id_idx").on(table.user_id),

    check("items_title_length", sql`char_length(${table.title}) <= 255`),
    check("items_body_length", sql`${table.body} IS NULL OR char_length(${table.body}) <= 4000`),
  ],
);
