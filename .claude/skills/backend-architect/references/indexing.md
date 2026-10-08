# Indexing — how to decide, not just how to create

This is the general decision framework: which columns earn an index, what
shape that index should take, and which index type. `performance-at-scale.md`
is the incident log of what happens when these rules are skipped — read that
one for "what broke and by how much," read this one for "how to decide before
it breaks."

Sources: [Use The Index, Luke](https://use-the-index-luke.com/) (the
canonical vendor-neutral SQL indexing reference — composite index theory,
index-only scans), [PostgreSQL docs — Index-Only
Scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html),
and current (2025) PostgreSQL indexing-strategy writeups on composite/partial/
covering index design.

## The only real question: does an access path exist that needs one?

An index exists to serve a **query the application actually runs** — a
`WHERE`, a `JOIN ON`, an `ORDER BY`. Never index a column "because it seems
important" or "just in case." Every index you add is a trade you're making:
faster reads on one path, in exchange for extra disk, extra RAM in the
buffer cache, and slower writes forever (every `INSERT`/`UPDATE`/`DELETE`
that touches an indexed column has to maintain every index on that column,
not just the table row). An index that doesn't back a real query is pure
cost with no offsetting benefit.

Before adding one, be able to name the exact query (or query shape) it
serves. If you can't, don't add it yet — add it when the query shows up.

## Composite indexes: column order is the whole game

A composite (multi-column) B-tree index is really one sorted structure, not
"multiple single-column indexes glued together." That means:

- **Leftmost-prefix rule**: an index on `(a, b, c)` can serve `WHERE a = ?`,
  `WHERE a = ? AND b = ?`, and `WHERE a = ? AND b = ? AND c = ?` — but
  **not** `WHERE b = ?` alone, or `WHERE c = ?` alone. Postgres can only
  use a prefix of the index's columns, left to right, with no gaps.
- **Ordering rule of thumb**: **equality columns first, range/sort columns
  after.** An index serving `WHERE store_id = ? AND is_active = true ORDER
  BY created_at DESC` should be shaped `(store_id, is_active, created_at
  DESC)` — the equality predicates narrow the index down to a small
  contiguous range, then the range/order column is already sorted within
  that range so Postgres never needs a separate sort step.
- **Most selective equality column first among equals**, when multiple
  equality columns exist and none of them is a hard access-path requirement
  — the one that eliminates the most rows earliest wins. In practice, the
  access pattern (what the app always filters by, e.g. `product_id` on a
  reviews table) usually dictates this more than raw selectivity math.
- This project's own cursor-pagination indexes already follow this:
  `(product_id, created_at desc, id desc)` — the FK equality filter first,
  then the two-column tiebreaker for stable ordering, exactly matching
  `cursorOrderBy`'s row-value comparison. Don't design a new paginated list
  index any other way.
- One index on `(a, b, c)` almost always beats three separate single-column
  indexes on `a`, `b`, `c` for a query that filters on all three — the
  planner can use at most one index efficiently per table per scan node in
  the common case (bitmap AND-ing multiple indexes exists but is a fallback,
  not something to design around).

## `NULLS FIRST`/`NULLS LAST` is part of the index's shape, not a footnote

Covered in depth in `performance-at-scale.md` — repeating the rule here
because it belongs in the design checklist, not just the postmortem: if a
column can be `NULL` and the query sorts by it, the index's null ordering
and the query's null ordering must match byte-for-byte, or the sort can't be
served by the index at all. Decide and write it explicitly on both sides
(`sql`\`col desc nulls last\`` on both the DDL and the query helper) —
never rely on either side's default.

## Partial indexes: shrink the index to the slice that's actually hot

If a query only ever cares about a subset of rows — `WHERE is_active =
true`, `WHERE deleted_at IS NULL`, `WHERE status = 'pending'` — and that
subset is meaningfully smaller than the full table, index only that subset:

```sql
CREATE INDEX products_active_pagination_idx
  ON products (store_id, created_at DESC, id DESC)
  WHERE is_active = true;
```

This does two things a full index can't: it's smaller (less disk, more of
it fits in cache, faster to maintain on writes to *inactive* rows since
they never touch this index), and the planner can use it for exactly the
filtered queries the app actually runs. The predicate in the index
definition must **syntactically match** the query's `WHERE` clause (or be
provably implied by it) or the planner won't consider the index at all —
this isn't a semantic "close enough," it's a literal match check.

Good candidates in an e-commerce schema: `is_active`/`is_deleted` soft-delete
flags, `status IN ('pending', 'processing')` on an orders table where 95% of
historical rows are `'completed'`/`'cancelled'` and nobody queries those by
status anymore, `response IS NULL` on a reviews table if "unanswered
reviews" becomes a real query.

## Covering indexes (`INCLUDE`): trade index size for skipping the heap entirely

If a query's `SELECT` list is fully satisfied by columns already in the
index (as key columns or `INCLUDE` columns) plus the columns it filters by,
Postgres can answer it as an **index-only scan** — no visit to the table
heap at all, only the index.

```sql
CREATE INDEX stores_owner_lookup_idx
  ON stores (owner_id)
  INCLUDE (name, image);
```

Real caveats, not just upside:

- Two things gate an index-only scan even when the index has every column:
  the **visibility map** must show the page as all-visible (recently
  updated/inserted rows may not be, until vacuum catches up), and the
  planner has to judge it cheaper than a regular index scan given the
  table's clustering factor.
- `INCLUDE` columns bloat the index (they're stored in every leaf page but
  don't participate in ordering/lookup) and still need maintenance on every
  write. **Design the index for the `WHERE`/`ORDER BY`/`JOIN` first. Only
  add `INCLUDE` columns afterward, backed by a measured index-only-scan
  win** — don't reach for `INCLUDE` on a hunch (this is Use The Index
  Luke's core warning on the pattern, and it holds here too).

## GIN vs GiST vs B-tree — match the index type to the operator, not the column type

A B-tree only helps `=`, `<`, `>`, `BETWEEN`, and `ORDER BY`. Nothing else.
Concretely in this schema:

- **Array containment** (`arrayContains`/`@>`/`&&` on `text().array()`
  columns like `products.colors`) needs `GIN`. A B-tree on an array column
  is simply not consulted for containment — already documented in
  `performance-at-scale.md`.
- **Full-text search** (`to_tsvector`) needs `GIN` on the `tsvector`
  expression, matched byte-for-byte to what the query computes — this
  project's prefix-match + trigram search stack depends on the GIN
  expression index exactly mirroring the query's `to_tsvector('simple',
  ...)` call.
- **Trigram similarity** (`pg_trgm`, the `%` operator, `similarity()`) needs
  `GIN ... gin_trgm_ops` (or `GIST ... gist_trgm_ops` when the same column
  also needs range/nearest-neighbor operators — GIN is faster to query and
  slower to build/update, GiST is the reverse; default to GIN unless writes
  are the bottleneck).
- **JSONB containment/existence** (`@>`, `?`, `?&`) needs `GIN` on the jsonb
  column, or a targeted B-tree on an extracted/generated scalar column if
  only one key is ever queried directly.
- Never assume "it's indexed" answers "is it indexed for *this operator*."
  A B-tree and a GIN index can both exist on the same column and serve
  completely disjoint sets of queries.

## FK columns are not auto-indexed — this bites every single time

Postgres auto-creates an index for a `PRIMARY KEY` and any `UNIQUE`
constraint. It does **not** auto-create one for a `REFERENCES`/foreign key.
Every `foreignKey()` in this codebase needs its own explicit `index()`
sitting right next to it in the same schema file — otherwise every join
through that FK, and every `ON DELETE CASCADE` Postgres has to execute
against the child table when a parent row is deleted, is a sequential scan.
This is the single most common missing-index bug in real schemas, precisely
because nothing errors when it's missing — it just quietly gets slower as
the child table grows.

## Expression indexes: the query must ask for the exact expression back

`CREATE INDEX ON users (LOWER(email))` only helps `WHERE LOWER(email) = ?`
— not `WHERE email = ?`, not `WHERE email ILIKE ?`. The planner does a
literal expression match, not a semantic one. If a lookup always normalizes
a column the same way (lowercased email, trimmed phone), put that exact
expression in the index and make sure every call site normalizes the same
way before querying — this project's `lower(email)` unique index on `users`
is the existing example to copy for any future case-insensitive lookup.

## BRIN: only for genuinely huge, naturally-ordered append-only data

BRIN (Block Range Index) trades precision for tiny size — it stores min/max
per block range instead of an entry per row, so it's 1-2 orders of magnitude
smaller than a B-tree but only useful when the column's physical storage
order correlates with its value order (classically: `created_at` on an
append-mostly table that's never reordered). Not relevant to this schema at
its current scale (100K–1M rows fits comfortably in a normal B-tree's memory
footprint) — this is a >10M-row-table decision, not a default.

## What NOT to index

- Low-cardinality boolean/enum columns queried **alone** with no other
  predicate (`WHERE is_active = true` against a table where 95% of rows are
  active) — the planner will correctly ignore an index that can't eliminate
  most rows and just sequential-scan anyway; the index is pure write-cost
  with no read benefit. (It's still worth having as the **leading column
  of a composite** alongside a genuinely selective column, or as a partial
  index's predicate — the "don't index" rule is specifically about a
  standalone single-column index on a low-selectivity flag.)
- Columns nothing ever filters, joins, or sorts by yet, "for later." Add the
  index in the same change as the query that needs it (per this skill's
  core philosophy) — a speculative index is guaranteed write-cost against a
  maybe-never read benefit.
- A second index that's a strict prefix of an existing one — `(a)` is
  redundant once `(a, b)` exists, since any query `(a)` could use, `(a, b)`
  serves too. Drop the redundant one instead of carrying both.
- Designing for `INCLUDE`/index-only scans before the base index is right.
  Get the `WHERE`/`ORDER BY`/`JOIN` columns correct and verified with
  `EXPLAIN` first; only then consider whether adding `SELECT`-list columns
  to `INCLUDE` measurably converts a regular index scan into an index-only
  one.

## Verification checklist for any new index

1. Name the exact query (real SQL, via `query.toSQL()` if unsure what the
   ORM emits) this index is for, before writing the `CREATE INDEX`.
2. Shape it: equality columns first (leftmost), then the range/sort column,
   explicit `NULLS FIRST`/`LAST` if the sort column is nullable, `WHERE`
   partial predicate if the query always filters to a hot subset.
3. Pick the index type by operator, not by column type — B-tree unless the
   query uses `@>`/`&&`/`?`/`%`/`to_tsvector`, in which case GIN (or GiST
   for range/geometric/exclusion operators).
4. After seeding realistic volume and `ANALYZE`, run `EXPLAIN (ANALYZE,
   BUFFERS)` on the real query and confirm the plan actually names this
   index (`Index Cond`, not `Filter`) and `actual rows=` stays near the
   query's real selectivity — see `performance-at-scale.md` for what a
   silently-ignored index looks like in a plan.
5. Check for redundancy against existing indexes on the same table before
   merging — a strict-prefix duplicate should be dropped, not added
   alongside.
