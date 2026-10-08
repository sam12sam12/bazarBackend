# Schema & Drizzle conventions

## PK/FK type follows the entity's role, not a blanket rule

Internal domain entities (products, orders, categories, ...) get
`bigserial('id', { mode: 'number' })`. Identity-bearing entities — anything
that must line up with an external identity system (auth users, in
particular) — get `uuid().defaultRandom()`. Every FK to that entity uses the
matching type. Don't default to uuid everywhere "for safety" or int
everywhere "for simplicity" — mixing deliberately by role is correct.

```ts
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(), // must match auth provider's id shape
  ...
});

export const products = pgTable('products', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  storeId: bigint('store_id', { mode: 'number' }).notNull()
    .references(() => stores.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull() // FK to a uuid entity is uuid, not bigint
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

## Relations power `db.query.*` for single-row joined reads; lists stay on `db.select()`

Declare the relational graph in one `db/schema/relations.ts` via
`defineRelations(schema, (r) => ({...}))` (the RQB v2 API — not the classic
`relations(table, ({ one, many }) => ...)` helper, which is for an older
relational query builder), and wire the result into `drizzle({ client,
relations })`. This is the one deliberate exception to "always use
`db.select()`, never `db.query.*`": a single-row lookup that needs a
relation joined in reads far better as

```ts
db.query.products.findFirst({
  where: { id },
  with: { store: { columns: { id: true, name: true, image: true } } },
})
```

than as hand-written `.select({ ...getTableColumns(products), store: {...} })
.leftJoin(stores, eq(products.store_id, stores.id))`. Both compile to
similar SQL (the relational API's version is a `LEFT JOIN LATERAL`
returning `row_to_json`, not a plain join) — the win here is purely
readability for the "one row plus its relations" shape, not performance.

**Keep list/pagination endpoints on `db.select()`.** Cursor pagination's
tuple-comparison `WHERE` (`(created_at, id) < (cursor_created_at,
cursor_id)`) and an `ORDER BY` that has to match an index's `NULLS LAST`
byte-for-byte (see `pagination.ts`'s `cursorOrderBy`) don't have a clean
equivalent in the relational API's filter/order config — trying to force
that through `db.query.*` fights the tool. `db.query.*` is for "fetch one
row plus its relations," not list endpoints.

## Strings are `text`, not `varchar(n)`

Postgres gives `varchar(n)` no storage/performance advantage over `text` —
the length cap is enforced identically either way. Use `text()` for every
string column and, where a length actually matters, add it as a `check()`
instead: `check('title_length', sql\`char_length(${table.title}) <= 255\`)`.
The `check()` form is also cheaper to change later (`ALTER ... DROP/ADD
CONSTRAINT` vs. a column type rewrite) and reads the same everywhere,
instead of some columns being `varchar` and others `text` for no
principled reason.

## Shared `timestamps` helper, spread into every domain table

```ts
export const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
    .$onUpdateFn(() => new Date()).notNull(),
};
// usage: pgTable('products', { ...columns, ...timestamps })
```

Hand-roll the same shape only where a third-party library (an auth adapter,
etc.) needs exact field-level control over that table — don't fight the
library's schema contract for the sake of using the shared helper.

## Centralize enums; re-derive a TS union where a service needs a state machine

Keep every `pgEnum` in one shared file, not colocated with its one table.
When an enum drives control flow (order status, request status), the
service layer should re-derive its own literal union + transition map
instead of relying only on the Drizzle-inferred type:

```ts
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
```
See [transactions-integrity.md](transactions-integrity.md) for how this map gets used.

## Hierarchies (`ltree`) and derived paths

- The canonical tree (e.g. `categories.path`) is the only place a path is
  ever *written by the client*.
- Anything that belongs to a node in that tree but isn't the tree itself
  (e.g. a store's category path, used for subtree filtering) stores a
  **derived copy**, computed server-side at write time by looking up the
  parent's path — never accepted from the client. Omit that field entirely
  from the create/update Zod schema.
- Every `ltree` column gets a mandatory GiST index:
  `index('x_path_idx').using('gist', table.path)`.
- Subtree queries use the `<@` operator directly in raw SQL against the DB —
  never fetch the tree into JS and filter there:
  ```ts
  sql`category_id IN (SELECT id FROM categories WHERE path <@ ${path}::ltree)`
  ```
- Any path value that reaches raw SQL from a query param must be
  allowlist-validated first (e.g. `/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/`) —
  see [controllers-services.md](controllers-services.md) rule on raw-SQL
  query params.

## JSONB: typed for fixed shapes, Zod-validated for variable shapes

- A small, fixed-shape object (an i18n name map, a settings blob with known
  keys) gets `.$type<T>()` on the column.
- A variable-shape or array JSONB column (images, specs, line-item
  snapshots) is left as plain `jsonb('col').default(sql`'[]'::jsonb`)` —
  structural validation is delegated entirely to a named, exported Zod
  schema, with a code comment on the column documenting the runtime shape.
  Don't try to force array/variable JSON into a Drizzle type parameter.

## Native Postgres arrays: filter with Drizzle's array operators, not raw SQL

A flat list of scalars (product colors, tags) is a native array column, not
JSONB — `text('colors').array()`. Filtering "does this array contain value
X" has a typed Drizzle operator; don't reach for a hand-written
`sql\`${value} = ANY(${column})\`` template when `arrayContains` says the
same thing with a real signature:

```ts
import { arrayContains } from 'drizzle-orm';
// column @> ARRAY[value] — "value is one of the elements"
if (filters?.color) conditions.push(arrayContains(products.colors, [filters.color]));
```

`arrayOverlaps`/`arrayContained` cover "any of these values"/"subset of"
the same way. Reach for raw `sql` on array columns only once you need
something none of the three cover.

## Index what you actually query

- **Full-text search**: a functional GIN index directly on
  `to_tsvector('simple', col1 || ' ' || col2)` — no separate stored
  tsvector column to keep in sync.
- **JSONB containment/filtering**: GIN index on the JSONB column itself.
- **Geo**: GiST index on `ll_to_earth(lat, lng)` (earthdistance) is enough
  for "nearby" queries — don't reach for PostGIS geometry types unless you
  need real geometric operations.
- **Paginated/filtered lists** (the single most consistent index pattern to
  replicate): a composite partial index shaped exactly like the query —
  `(filter_col, created_at desc, id desc) WHERE is_active = true`. One
  variant per real filter combination the service actually uses (by store,
  by category, by province, global) — not one giant multi-column index
  trying to serve all of them. Add the index in the same change as the
  query that needs it, and leave a comment describing the query shape it
  backs so a future column change updates both together.

## `onDelete` policy by relationship role, not by default

| Relationship role | Policy | Example |
|---|---|---|
| Ownership chain (child can't exist without parent) | `cascade` | `stores.owner_id → users` |
| Reference/lookup/classification data | `restrict` | `products.category_id → categories` |
| Historical/audit record that must survive parent deletion | `set null` | `orders.shipping_address_id → addresses` |

Self-referencing hierarchy FKs (`parent_id`) are `restrict` — you can't
delete a node that still has children.

## Snapshot-on-write for anything that must survive its source mutating

If a row (an order, an invoice line) must never visually change because
someone later edited or deleted the record it was built from, copy the
needed display fields onto the dependent row *at write time*, in addition
to keeping the FK:

```ts
export const orderItems = pgTable('order_items', {
  ...
  productId: bigint('product_id', { mode: 'number' })
    .references(() => products.id, { onDelete: 'set null' }), // for joins, if it still exists
  title: text('title').notNull(),        // snapshot at purchase time
  unitPrice: numeric('unit_price').notNull(), // snapshot at purchase time
});
```

## `check()` constraints mirror Zod `.refine()` — belt and suspenders

When a business rule spans two columns (e.g. "exactly one of `productId`/
`storeId` must be set, matching `type`"), enforce it in both places: a
Postgres `check()` as the real guarantee (protects every writer, including
future scripts/admin tools), and an identical Zod `.refine()` at the API
boundary purely for a friendly 400 instead of a raw constraint violation.

## Unique constraints are idempotency guards, not just data-integrity noise

Design unique constraints around the operations you'll actually perform,
then exploit them in the service:

- "Toggle a favorite" → unique `(user_id, product_id)` +
  `.onConflictDoNothing()` on insert, plain delete to un-favorite.
- "Bump last-viewed timestamp instead of inserting duplicate view rows" →
  unique `(user_id, product_id)` + `.onConflictDoUpdate({ set: { viewedAt: now } })`.
- "Only one default address per user" → a **partial unique index**
  `WHERE is_default = true`, enforced by unsetting the previous default in
  the same service call rather than a trigger.

Never implement any of these as "SELECT to check, then INSERT" — that's a
race condition between concurrent requests.
