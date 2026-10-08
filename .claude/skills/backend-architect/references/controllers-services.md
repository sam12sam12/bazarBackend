# Controller & service conventions

## Controllers do exactly four things, in order

Parse params/query/body (already validated by middleware) → an inline
ownership/authorization check if needed → one service call → shape the
response. If you find yourself writing a loop, a query, or more than one
`if` of business logic in a controller, move it to the service.

```ts
export async function updateReview(c: Context<ReviewEnv>) {
  const { id } = c.get('validatedParams');
  const body = c.get('validatedBody');
  const review = await reviewService.getById(id);
  if (!review) throw ApiError.notFound('Review not found');
  if (review.userId !== c.get('user').id) throw ApiError.forbidden('You do not own this review');
  const updated = await reviewService.update(id, body);
  return c.json({ success: true, data: updated });
}
```

## Ownership checks are inline per controller, not a generic middleware

The owner field name differs per resource (`userId` vs `ownerId` vs
`buyerId`), and you need to fetch the row anyway to return a correct 404 vs
403. Writing the check inline, every time, in the same shape, is more
readable than a generic middleware trying to abstract over different field
names:

```ts
if (resource.ownerId !== user.id && user.role !== 'admin') {
  throw ApiError.forbidden('You do not own this resource');
}
```
Admin bypass is always the second clause of the same boolean, never a
separate early-return branch.

For a resource owned *via* a parent (a product via its store), fetch with
the parent's owner column included in one relational query rather than two
round trips:
```ts
const product = await db.query.products.findFirst({
  where: eq(products.id, id),
  columns: { id: true, storeId: true },
  with: { store: { columns: { ownerId: true } } },
});
if (product.store.ownerId !== user.id && user.role !== 'admin') throw ApiError.forbidden(...);
```

## Keep a cheap "auth projection" separate from the "display projection"

A method used only to check ownership should select the minimum columns
needed for that check (id + owner chain). The method used to render the
resource pulls everything the UI needs. Don't reuse the heavy display query
just to check ownership — it's wasted work on every mutation.

## Raw-SQL query params get an allowlist regex exactly where they're read

Any query-string value that will be interpolated into a raw SQL fragment
(an `ltree` cast, a dynamic column/table name) must be validated against a
strict allowlist regex in the controller before it reaches the service —
in addition to (not instead of) using parameterized values everywhere else:

```ts
const categoryPath = c.req.query('category_path');
if (categoryPath && !/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(categoryPath)) {
  throw ApiError.badRequest('Invalid category_path');
}
```
Parse boolean-like query params explicitly (`query.featured === 'true'`),
never `Boolean(query.featured)` — `Boolean('false')` is `true`.

## Hardcode the page size server-side

```ts
const limit = 12; // not client-configurable — don't accept ?limit= from the request
```
Every paginated endpoint picks one fixed limit. Accepting a client-supplied
limit invites abuse (someone requesting 10,000 rows per page).

## Fire-and-forget non-critical side effects

View counts, best-effort notifications, and anything else that "records
that something happened" but shouldn't be able to fail the request:

```ts
productService.incrementViews(id); // not awaited
productViewService.recordView(userId, id).catch((err) => console.error('recordView failed', err));
return c.json({ success: true, data: product });
```
A logging/analytics failure must never turn a 200 into a 500.

## Return the minimum the client needs

Default a mutation's response `data` to an id or a short confirmation
string. Return the full/updated row only when the client's very next UI
action depends on the new state immediately (e.g. an optimistic toggle
needs `{ id, favorited: true }` back to update the button without a
refetch).

## Two query styles, chosen deliberately

- `db.query.<table>.findFirst/findMany({ with: {...} })` — anything that
  needs related rows (owner, nested children, joins for display).
- `db.select({...}).from(table).where(...)` — flat, single-table, hot-path
  list feeds where you want exact control over the projected columns.

For a hot-path list feed queried from several service methods (e.g. "all
the ways to list products": popular, by store, by category, related), don't
re-declare the column list each time. Export one named constant and reuse
it everywhere, including from other services that need the same shape:

```ts
export const PRODUCT_LIST_COLUMNS = { id: products.id, title: products.title, price: products.price, /* ... */ };
// used by productService.getAll/getPopular/getFeed/getByStoreId, and imported by favoriteProductService
```

## Cursor pagination, everywhere — never OFFSET/LIMIT

Build (or reuse) one shared pair of utilities:

```ts
function buildCursorFilter(table: { created_at: Column; id: Column }, cursor?: CursorData, idTransform = Number) {
  if (!cursor) return undefined;
  return or(
    lt(table.created_at, cursor.created_at),
    and(eq(table.created_at, cursor.created_at), lt(table.id, idTransform(cursor.id))),
  ); // tuple comparison — plain `created_at < X` alone breaks ties when rows share a timestamp
}

async function paginateResults<T extends { created_at: Date; id: unknown }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return { items: page, hasMore, nextCursor: last ? encodeCursor(last) : undefined };
}
```

Every list method: fetch `limit + 1` ordered by `(created_at desc, id desc)`,
pass the result through `paginateResults`. Wrap the two together in a small
combinator so a service with its own filters doesn't hand-write
`cursor ? buildCursorFilter(table, cursor) : undefined` inline every time:

```ts
function withCursor(table: { created_at: Column; id: Column }, cursor: CursorData | undefined, ...conditions: (SQL | undefined)[]) {
  return and(...conditions, cursor ? buildCursorFilter(table, cursor) : undefined);
}
function cursorOrderBy(table: { created_at: Column; id: Column }) {
  return [desc(table.created_at), desc(table.id)] as const;
}

// One line per optional filter instead of a `cond ? build(v) : undefined`
// ternary repeated per field, and still fully type-checked (no `as any`
// the way a config-driven map over the filters object would need):
function when<T>(value: T | undefined | null, build: (value: T) => SQL): SQL | undefined {
  return value != null ? build(value) : undefined; // no `!== ''` guard — trust the Zod boundary already forbids it
}

// usage — every filter is one `when(...)` line, cursor folded in by withCursor:
const where = withCursor(
  products, cursor,
  eq(products.isActive, true),
  when(filters?.category, (v) => eq(products.category, v)),
  when(filters?.minPrice, (v) => gte(products.price, v)),
);
await db.select(COLS).from(products).where(where).orderBy(...cursorOrderBy(products)).limit(limit + 1);
```

At 15-20 filters, resist reaching for a `{ key: builder }` config map iterated
via `Object.entries()` — it can't narrow `builder`'s argument type per key at
that point, so every entry needs an `as any`. One `when(...)` line per filter
keeps full inference and is no more code than the map would have been.

Design these utilities duck-typed against `{ created_at: Column, id: Column }`
(not tied to one table type) so:

- an entity with a **uuid** PK can pass `idTransform: String` instead of
  the default `Number`;
- a **join-table** pagination (e.g. "favorited at") can remap fields before
  calling in: `buildCursorFilter({ created_at: table.favoritedAt, id: table.productId }, cursor)`
  and `rows.map(r => ({ ...r, created_at: r.favoritedAt }))`.

Don't hand-roll this logic again inside one service "because it's slightly
different" — extend the shared utility's parameters instead. Two
implementations of the same tie-breaking comparison is exactly the kind of
subtle bug source that shows up as "pagination skips a row when two items
share a timestamp" months later.

## Counter maintenance strategy — pick by write frequency

| Frequency | Strategy |
|---|---|
| Very high (view counts) | In-memory buffer (`Map<id, delta>`), flushed on an interval with one batched `UPDATE ... CASE id WHEN ... END` |
| Medium (favorites, follows, stock) | Inline atomic `sql` increment/decrement in the same statement as the write, always `GREATEST(col - 1, 0)` on decrement so a race or double-processed event can't push it negative |
| Aggregate (avg rating, counts derived from child rows) | Fully recompute from source rows after every mutation (`COUNT(*)`, `AVG(...)` via a correlated subquery) rather than incrementally maintaining a running sum — incremental average maintenance is a common source of drift bugs and the recompute is cheap at review-scale volumes |

## JSONB array mutation is one atomic UPDATE, never read-modify-write

```ts
// append — atomic concat, no read first
await db.update(products).set({ images: sql`${products.images} || ${JSON.stringify(newImages)}::jsonb` }).where(...);

// remove — filter via jsonb_agg over jsonb_array_elements, COALESCE guards the "removed the last one" case
await db.update(products).set({
  images: sql`COALESCE((SELECT jsonb_agg(elem) FROM jsonb_array_elements(${products.images}) elem WHERE elem->>'url' != ${url}), '[]'::jsonb)`,
}).where(...);
```
Without the `COALESCE`, `jsonb_agg` over zero remaining rows returns `NULL`
— removing the last image would null out the whole column instead of
leaving `[]`. Never `SELECT` the JSON column into JS, mutate the array, and
`UPDATE` the whole thing back — that's a lost-update race between two
concurrent requests.

## N+1 avoidance

Fetching related rows for a list of parent ids: one `inArray(table.parentId, ids)`
query, never a loop issuing one query per parent. Updating many rows with
different values each: one `UPDATE ... SET col = CASE id WHEN a THEN x WHEN b THEN y END WHERE id IN (...)`,
never N separate `UPDATE ... WHERE id = ?` calls — fewer round trips, and it
keeps the whole batch atomic within a transaction/lock scope.
