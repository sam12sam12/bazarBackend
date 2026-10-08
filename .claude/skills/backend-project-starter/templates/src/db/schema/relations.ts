import { defineRelations } from "drizzle-orm";
import * as schema from "./index";

// Declares the relational graph so `db.query.*` (the relational query API)
// works — see db.ts's comment on why this project uses it for joined reads
// instead of `db.select().leftJoin()`. `defineRelations`, not the classic
// `relations(table, ({ one, many }) => ...)` helper — this drizzle-orm
// version (1.0.0-rc.4) ships the newer relational query builder v2, and
// `defineRelations` is its API.
//
// Add every new table's relations here as it's added. This starter only
// wires up the one example table (see exampleSchema.ts) — delete the
// `items`/`user` entries below when that table is deleted too.
export const relations = defineRelations(schema, (r) => ({
  users: {
    items: r.many.items({
      from: r.users.id,
      to: r.items.user_id,
    }),
  },
  items: {
    user: r.one.users({
      from: r.items.user_id,
      to: r.users.id,
    }),
  },
}));
