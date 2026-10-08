---
name: backend-architect
description: Apply when writing, reviewing, or extending backend code in this stack (Bun/Node + Hono + Drizzle ORM + Postgres + Zod) — schema design, controllers, services, validation, auth/authorization, transactions, pagination, error handling. Encodes conventions extracted from a production-grade reference backend so new code matches senior-engineer decisions (indexing strategy, race-condition-safe writes, trust boundaries) instead of the first naive implementation that passes a happy-path test. Trigger on: new table/migration, new endpoint, new service method, "add pagination", "add a transaction", auth/ownership checks, JSONB columns, counters, checkout/inventory-style flows.
---

# Backend Architect

This skill is a distilled rulebook from auditing a mature production backend
(Bun + Hono + Drizzle + Postgres + Zod + better-auth) line by line — not
generic "best practices," but the specific decisions a senior engineer made
that a capable-but-junior dev typically wouldn't think of on their own. Use
it to make this project's backend read like one senior engineer wrote all of
it.

## Core philosophy

- **Controller → Service → DB, strictly.** A controller does: parse
  params/body → maybe one inline ownership check → one service call → shape
  `{success, data}`. If a controller has more than ~3 statements of logic,
  that logic belongs in the service.
- **Never trust the client for anything the server can derive or compute.**
  Ownership FKs come from the session or the URL, never the body. Prices/
  totals are recomputed server-side. Comment the trust boundary at the exact
  line where server-derived data gets written.
- **Prefer atomic, race-free DB operations over check-then-act in JS.**
  `onConflictDoUpdate`/`onConflictDoNothing` over check-then-insert,
  `SELECT ... FOR UPDATE` + one batched `CASE` update over read-modify-write,
  DB `check()` constraints as the real guarantee with Zod as the friendly
  error on top — not either/or.
- **Only reach for `db.transaction` when ≥2 writes must succeed or fail
  together.** Don't wrap single-statement writes in a transaction out of
  habit.
- **Index the exact query the service runs, when you write the query.**
  A new filtered/paginated list method should ship with the index that
  makes it fast, in the same change. Column order, index type (B-tree vs
  GIN vs GiST), partial predicates, and `INCLUDE` columns are all decisions
  driven by the query shape, not defaults — see
  [references/indexing.md](references/indexing.md).
- **"Fast in dev" is unverified until checked at real scale.** A query can
  look correct, have an index that looks right, and still silently do a
  full table scan — invisible at dev-seed row counts, only surfacing once a
  table hits real volume. See
  [references/performance-at-scale.md](references/performance-at-scale.md)
  — read it before trusting any pagination/filter/aggregate query design.
- **One error path.** Services/controllers only ever throw `ApiError.*` or
  return success data; exactly one global handler turns errors into HTTP
  responses.

## Reference files — load the one matching what you're doing

| File | Load when you're... |
|---|---|
| [references/schema-drizzle.md](references/schema-drizzle.md) | Designing a table, adding an index, choosing a PK/FK type, modeling JSONB or a tree/hierarchy |
| [references/validation-zod.md](references/validation-zod.md) | Writing create/update Zod schemas, deciding what a client is allowed to send |
| [references/controllers-services.md](references/controllers-services.md) | Writing a controller or service method, adding pagination, ownership checks, counters |
| [references/transactions-integrity.md](references/transactions-integrity.md) | Anything touching stock/inventory, money, multi-row writes, status state machines |
| [references/auth-middleware.md](references/auth-middleware.md) | Auth/session handling, role checks, middleware ordering, rate limiting |
| [references/errors-responses.md](references/errors-responses.md) | Throwing/handling errors, shaping the response envelope, cursor pagination format |
| [references/indexing.md](references/indexing.md) | Deciding whether a column needs an index, what shape (composite order, partial, covering) and type (B-tree/GIN/GiST) it should be |
| [references/performance-at-scale.md](references/performance-at-scale.md) | Writing any list/pagination/filter/aggregate query — before trusting it's actually fast, not just "has an index" |

## Naming & style (apply everywhere, no reference file needed)

- Files: `xController.ts` / `xService.ts` / `xSchema.ts` / `xRouter.ts` (or
  this project's existing `x.controller.ts` style — match whatever the repo
  already uses, don't mix conventions).
- Services and controllers are plain object literals of async methods
  (`export const xService = { async method() {...} }`), not classes.
- Private helpers used by only one service live at the bottom of that
  service's own file, not in a shared `utils/` — only promote to a shared
  util once ≥2 services need the same logic (and then actually import the
  shared version everywhere, don't let a third copy drift in).
- Use `// ── Section ──`-style banner comments to delimit logical groups in
  large schema/service/validation files — cheap, consistent, and makes
  multi-hundred-line files skimmable.

## Known anti-patterns to actively avoid

These are real inconsistencies found even in the reference codebase —
don't imitate them just because "the pro codebase does it somewhere":

- **Don't let the pagination response envelope drift per resource.** Pick
  one shape (`nextCursor`/`hasMore` nested *inside* `data`) and use it on
  every paginated endpoint. Don't silently drop a `hasMore` the service
  computed just because one caller destructured it away.
- **Don't reimplement shared pagination/cursor logic locally** "because
  this one service is slightly different." Extend the shared
  `buildCursorFilter`/`paginateResults` utility (add a param) instead of
  hand-rolling the same OR/AND tuple comparison a second time.
- **Don't copy-paste the same regex literal (phone numbers, etc.) into
  three separate schemas.** Extract it into one named, exported Zod schema
  the first time it's needed a second place.

## Before calling backend work done

- Does every new filtered/paginated query have a matching index, **and has
  it been checked with `EXPLAIN (ANALYZE, BUFFERS)` at realistic row
  counts** — not just "an index exists," but `actual rows=` on every plan
  node staying near the query's real selectivity/`LIMIT`? An `ORDER BY`
  that doesn't match its index's null-ordering, or a missing composite
  index, silently degrades to a full scan with no error and no obviously
  wrong result — see performance-at-scale.md.
- Can two concurrent requests hit this code path and corrupt state (double
  decrement, lost JSONB update, duplicate row)? If yes, fix it with a DB
  constraint + atomic op, not a pre-check.
- Does the controller trust anything from the client body that it
  shouldn't (ownership id, price, status)?
- Are all error throws going through `ApiError.*`, and is there nothing
  constructing an error JSON response outside the global handler?
