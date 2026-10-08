# Performance at real scale

Every rule here comes from a real incident: a query that looked fine, had an
index that looked right, and was still doing a full scan — invisible at
dev-seed sizes (dozens to a few hundred rows), only surfacing once the table
actually held ~1,000,000 rows. Treat "seems fast in dev" as unverified until
you've checked it at realistic volume.

## `ORDER BY` must match the index byte-for-byte, including null ordering

This is the single most expensive mistake in this list, because it's
completely invisible until real scale: a query and an index can agree on
every column and still not let the planner skip the sort, because Postgres's
implicit default null-ordering for `DESC` is **`NULLS FIRST`**, not
`NULLS LAST`.

- drizzle-kit's DDL generator canonicalizes a schema index's `.desc()` into
  `CREATE INDEX ... (col DESC NULLS LAST)` — always, explicitly.
- The query-side `desc(column)` helper emits plain `... ORDER BY col DESC` —
  no `NULLS` clause at all, so Postgres applies its own default, `NULLS
  FIRST`.
- Result: the index is `DESC NULLS LAST`, the query asks for `DESC NULLS
  FIRST` (implicitly). They don't match. The planner can't prove the index's
  output order satisfies the query's `ORDER BY`, so instead of walking the
  index and stopping at `LIMIT`, it scans every matching row and sorts them
  in memory.
- At 100 rows this costs nothing — a full scan+sort of 100 rows is
  microseconds either way, so it's silently "correct but wasteful" and never
  gets noticed. At 1,000,000 rows with a 94%-selective filter, this was a
  **3.15 second** query that scanned 941,176 rows to return 12. Making the
  query emit `NULLS LAST` explicitly (matching the index) dropped it to
  **0.4ms**, touching exactly 13 rows.

**Fix**: for any table-shared cursor-pagination order helper, spell out
`NULLS LAST` explicitly with `sql` fragments rather than the plain
`asc()`/`desc()` helpers:

```ts
export function cursorOrderBy(table: { created_at: Column; id: Column }) {
  return [
    sql`${table.created_at} desc nulls last`,
    sql`${table.id} desc nulls last`,
  ] as const
}
```

**Verify, don't assume**: `EXPLAIN (ANALYZE, BUFFERS)` the actual query.
Look for `rows=<limit>` on the top node — if the `Sort` or scan node's
`actual ... rows=` is anywhere near the table's full row count instead of
your `LIMIT`, the index isn't doing its job, no matter how confident the
plan's node names look ("Index Scan" can still be followed by a full `Sort`
over everything it found).

## Keyset/cursor pagination: use a real row-value comparison, not its OR/AND decomposition

`(created_at, id) < (cursor_created_at, cursor_id)` and `created_at <
cursor_created_at OR (created_at = cursor_created_at AND id <
cursor_id)` are **logically equivalent** — same rows, same order — but only
one of them lets the planner push the comparison down into the index as a
bounded `Index Cond`. The OR/AND form only ever shows up in `EXPLAIN` as a
`Filter`, which means: fetch every remaining row from the cursor to the end
of the table, in index order, checking each one — no early stop.

- On page 1 this is invisible (nothing to skip past yet).
- 500,000 rows deep into a 1,000,000-row table, a page fetch with the OR/AND
  form took **730ms** and touched 500,001 rows via `Filter`. The row-value
  form (`Index Cond: ROW(created_at, id) < ROW(...)`) did the identical
  fetch in **13ms**.
- Worse case: a cursor past the end of the actual data (or the true last
  page) forces a scan of the *entire remaining table* trying to find a match
  that doesn't exist — measured at **1.25 seconds** for a "no more results"
  response that should be instant.

**Fix**: build the comparison as a real SQL row constructor, not
`or(lt(...), and(eq(...), lt(...)))`:

```ts
function buildCursorFilter(table: { created_at: Column; id: Column }, cursor: CursorData) {
  return sql`(${table.created_at}, ${table.id}) < (${new Date(cursor.created_at)}, ${cursor.id})`
}
```

This is a single shared helper every paginated endpoint in the app goes
through — fixing it there fixes every list at once, and is also exactly why
it's worth centralizing this logic instead of letting each service hand-roll
its own cursor comparison (see `controllers-services.md`'s "don't
reimplement shared pagination logic" rule): a bug (or a fix) here is a bug
(or a fix) everywhere, not once per resource.

**Verify**: this is the one bug class in this whole doc that a page-1 test
*cannot* catch, by construction — there's nothing to skip past yet. Test
page depth explicitly: pull a real `(created_at, id)` from far into the
table (`OFFSET 500000 LIMIT 1` while developing) and `EXPLAIN (ANALYZE,
BUFFERS)` a query using it as the cursor. `Index Cond` naming the row
comparison = bounded. `Filter` naming it = scanning everything remaining.

## Every paginated/filtered list needs the exact index that backs it, in the same change

Not "an index on the column" — a composite, shaped like the query:
`(filter_col, created_at desc, id desc) WHERE is_active = true`. A missing
index doesn't error, it just silently degrades to a sequential scan that
gets linearly worse as the table grows. Concretely hit this twice in one
session:

- Copied a `getAll` pattern from one resource to a sibling resource (Product
  → Store) but forgot the matching pagination index on the new table's
  schema file. Typechecked fine, worked fine locally with a handful of
  seeded rows, and quietly cost **695ms** once the table held 1,000,000 rows
  — a full scan every single page load.
- A `WHERE category = ? AND is_active = true` filter with no supporting
  index works "fine" at small scale because the planner can lean on
  whatever pagination index exists and just filter the extra predicate in
  memory. It stops being fine well before 1,000,000 rows.

FK columns specifically: Postgres does **not** auto-index a foreign key the
way it auto-indexes a primary key. Every `foreignKey()` needs its own
`index()` right next to it, or a lookup/join through that FK does a
sequential scan forever.

## Native array columns need GIN for containment, B-tree can't help

`text('colors').array()` filtered with `arrayContains(col, [value])` needs
`index(...).using('gin', table.col)`. A plain B-tree index on an array
column doesn't support containment queries at all — the planner will ignore
it for `@>`/`&&` and fall back to a full scan.

One thing GIN does **not** fix: "give me every distinct value across all
rows" (`SELECT DISTINCT unnest(colors) FROM t`) is not a containment query —
it's forced to visit every matching row and expand every array regardless of
any index, because there's nothing to look up, only everything to
enumerate. That's a structural limit of storing repeatable facet values in
an array column, not a missing-index problem — the real fix is normalizing
into a proper lookup table for anything queried as "all distinct values," a
different shape of change than adding an index.

## Aggregate/facet queries: compute in Postgres, don't fetch-then-reduce in JS

"Distinct categories, distinct colors, min/max price for a filter UI" is
naturally *n* rows in, *k* distinct values out — do that reduction in SQL
(`selectDistinct`, `min()`/`max()`), never by `select()`-ing every matching
row's raw columns into the app and building a `Set`/`Math.min` over them in
JS. The JS-side version transfers and holds the **entire filtered table**
in memory per request; the SQL-side version returns only the small distinct
result. Measured on the same 1,000,000-row table: **8.07s** (fetch full
rows, dedupe in JS) → **1.48s** (`selectDistinct`/`MIN`/`MAX` in Postgres,
same missing supporting indexes added alongside). Same query, 5.5x just from
moving the reduction into the database — before even accounting for the
indexes.

## Re-run `ANALYZE` after any bulk load before trusting a plan

A fresh bulk insert (a seed script, a migration backfill) can leave the
planner working off stale or absent statistics until autovacuum's autoanalyze
gets around to it — which, right after a huge insert, might not be soon.
Run `ANALYZE <table>` explicitly right after seeding/bulk-loading before you
benchmark anything, or you're measuring the planner's guesswork, not its
real behavior.

## The actual verification habit this all comes down to

1. Seed at a realistic volume (tens of thousands of rows minimum, ideally
   the six-to-seven-figure range a real table would reach) before trusting
   any index design — a handful of dev rows will hide every mistake above.
2. `ANALYZE` after loading.
3. `EXPLAIN (ANALYZE, BUFFERS)` the actual query your service runs (pull the
   real SQL via `query.toSQL()` if there's any doubt what the ORM emits) —
   read `actual rows=` on every node, not just which index name shows up.
4. For anything paginated, test **page 1 and a page deep into the table**,
   not just page 1 — the cursor-comparison bug above is invisible on page 1
   by construction, since there's nothing yet to skip past.
5. If a node touches meaningfully more rows than the query's `LIMIT`/real
   selectivity should require, something (an `ORDER BY` mismatch, a missing
   composite index, or an unpushed cursor comparison) is silently defeating
   the index that "exists."
