# Transactions & data integrity

## Only wrap ≥2 dependent writes in `db.transaction`

A single UPDATE/INSERT/DELETE never needs a transaction wrapper — it's
already atomic. Reach for `db.transaction(async (tx) => {...})` only when
two or more statements must succeed or fail together (e.g. "update order
status" + "restock items" only happens together on cancellation — the plain
status update path with no restock does *not* open a transaction at all).

Inside the callback, every statement must use the `tx` handle passed in —
never the outer `db` — or it silently runs outside the transaction.

Throwing an `ApiError` from inside the callback is the correct way to abort:
Drizzle's `transaction()` catches the throw and issues a ROLLBACK, so
there's no manual rollback bookkeeping needed.

## Locking for multi-row stock/inventory mutations

The pattern for "decrement stock for N products as part of one order,
safely under concurrency":

```ts
await db.transaction(async (tx) => {
  const rows = await tx.select().from(products).where(inArray(products.id, ids)).for('update');
  // validate is_active / sufficient quantity AFTER acquiring the lock —
  // checking before the lock is a TOCTOU race: another request could
  // decrement between your check and your write.
  for (const row of rows) {
    if (!row.isActive) throw ApiError.badRequest(`${row.title} is no longer available`);
    const requested = requestedQty.get(row.id)!;
    if (row.quantity < requested) throw ApiError.conflict(`Insufficient stock for ${row.title}`);
  }
  await batchDecrementStock(tx, rows.map((r) => ({ id: r.id, newQty: r.quantity - requestedQty.get(r.id)! })));
});

function batchDecrementStock(tx: Tx, updates: { id: number; newQty: number }[]) {
  const cases = updates.map((u) => sql`WHEN ${u.id} THEN ${u.newQty}`);
  return tx.execute(sql`
    UPDATE products SET quantity = CASE id ${sql.join(cases, sql` `)} END
    WHERE id IN (${sql.join(updates.map((u) => u.id), sql`, `)})
  `);
}
```
One `SELECT ... FOR UPDATE` locks every involved row up front; one batched
`CASE` statement applies every new quantity — never a loop of N separate
`UPDATE ... WHERE id = ?` calls inside the transaction.

## State machines for status fields, not `if`/`else` chains

```ts
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
const STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
  paid: 'paidAt', shipped: 'shippedAt', delivered: 'deliveredAt', cancelled: 'cancelledAt',
};

async function updateStatus(id: number, next: OrderStatus) {
  const order = await getById(id);
  if (!ALLOWED_TRANSITIONS[order.status].includes(next)) {
    throw ApiError.badRequest(`Cannot transition from ${order.status} to ${next}`);
  }
  const timestampCol = STATUS_TIMESTAMP[next];
  const patch = timestampCol ? { status: next, [timestampCol]: new Date() } : { status: next };
  if (next === 'cancelled') {
    return db.transaction(async (tx) => {
      await restockItems(tx, id);
      return tx.update(orders).set(patch).where(eq(orders.id, id)).returning();
    });
  }
  return db.update(orders).set(patch).where(eq(orders.id, id)).returning();
}
```
Adding a new status or side effect means adding one map entry, not
threading a new branch through every place status is checked.

## Money is always server-computed, never trusted from the client

```ts
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
```
The checkout schema only accepts `{ productId, quantity }` per line — no
price field. The server re-fetches current prices inside the same
transaction that locks the stock rows, computes line totals and the order
total with `round2`, and writes the rounded value with `.toFixed(2)` into
the `numeric` column. Comment this trust boundary at the point of
computation: `// server-computed, never trusted from client`.

## Snapshot financial/display data at write time

Order line items duplicate `title`/`image`/`unitPrice`/`currency` from the
product at purchase time rather than joining live to `products` for
display — an order must never visually change because the underlying
product was edited or deleted later. Same reasoning for a shipping-address
snapshot alongside the FK reference.

## Multi-entity fan-out with a correlation id

When one client action must become several independent rows (e.g. a
multi-store cart becomes one `orders` row per store), generate a single
`uuid` up front and stamp it on every resulting row (`checkoutGroupId`) so
they can be queried back together. Do the grouping in-memory after the lock
is acquired (group the locked rows by `storeId`), and explicitly reject
invariant violations that don't make sense per group — e.g. mixed
currencies within one store's sub-order — with a clear `ApiError.badRequest`.

## Fire notifications after commit, not inside the transaction

```ts
await db.transaction(async (tx) => { /* the actual business writes */ });
notifyStoreOwners(orderId).catch((err) => console.error('notifyStoreOwners failed', err));
```
A notification insert failing must never roll back the business
transaction it's reporting on. Filter out self-notifications
(`if (store.ownerId !== buyerId)`) before sending.

## Idempotent counter/version bumps via upsert, never read-then-write

```ts
await db.insert(contentVersion)
  .values({ id: 1, version: 2 })
  .onConflictDoUpdate({ target: contentVersion.id, set: { version: sql`${contentVersion.version} + 1` } });
```
This self-heals (creates the row if it never existed) and increments
atomically (no `SELECT version` then `UPDATE version = x + 1` race window)
in one statement, regardless of whether the row already existed.

If a cache-invalidation version needs to bump on *every* write path for a
class of tables, make that bump part of the same transaction as the
mutation, on every single mutating method for that class — a hard rule
with zero exceptions, not a "usually remember to call it" convention.

## A transactional helper should work both inside and outside a transaction

```ts
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function bumpVersion(tx: Tx | typeof db = db) { /* ... */ }
```
Default the parameter to the plain `db` client so the same function is
callable as `bumpVersion(tx)` from inside a transaction or `bumpVersion()`
standalone, without two copies of the logic. Define the `Tx` type once and
export it — don't redeclare the same type expression in every service file
that needs it.

## Soft-delete vs hard-delete

Soft-delete (`isActive = false`) when the entity is `restrict`-referenced
by other tables (deleting it outright would fail or orphan references) or
is an identity record (a user). Hard-delete everything else and let
`cascade`/`set null` FK policies clean up dependents.
