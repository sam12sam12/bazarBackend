# Zod validation conventions

## The select/insert/update triad, always derived in that order

```ts
export const selectProductSchema = createSelectSchema(products);

export const insertProductSchema = createInsertSchema(products, {
  price: () => priceStringSchema,
  images: () => productImagesArraySchema,
}).omit({
  id: true, storeId: true, viewCount: true, favoriteCount: true, // server-derived, see below
}).strict();

export const updateProductSchema = insertProductSchema.partial().strict();
```

`update` is **always** `insertXSchema.partial().strict()` — never
hand-written separately. Any refinement added to `insert` (a regex, a
`.refine()`) then automatically applies to `update` too, with zero risk of
the two schemas drifting apart.

## `.strict()` on every insert/update schema

Without `.strict()`, Zod's default behavior is to silently drop unknown
keys — which can mask a client bug or an attempted privilege-escalation
payload (trying to set `isActive`/`approvalStatus`/`role` directly) instead
of surfacing it. `.strict()` turns that into a hard 400.

## Omit server-controlled columns from the schema — don't rely on `.strict()` alone

`.strict()` protects against *unknown* keys. It does nothing if the field
is a real column the client simply shouldn't be trusted to set (an
ownership FK, a moderation/approval flag, a computed counter). Those fields
must never appear in the create schema in the first place:

```ts
export const createStoreSchema = createInsertSchema(stores, { ... }).omit({
  ownerId: true,        // comes from the session, never the body
  path: true,           // derived server-side from the chosen category
  isActive: true, approvalStatus: true, approvedAt: true, // moderation-only
  productCount: true, averageRating: true, reviewCount: true, // computed
}).strict();
```
The controller then builds the insert value by merging validated body +
`ownerId: c.get('user').id` + the derived `path` — the schema and the
controller together are the actual mass-assignment defense, not `.strict()`
in isolation.

## Extract repeated domain regexes into one named schema

If the same regex (a phone format, a currency code, a slug pattern) would
appear in more than one schema, define it once and reuse it:

```ts
export const afghanPhoneSchema = z.string()
  .regex(/^(?:\+93|0)7\d{8}$/, 'Invalid phone number');
```
Don't paste the literal regex into every schema that needs it — that's how
a future format fix only lands in two of the three places.

## Query-param filter schemas skip `.strict()` — a GET can't mass-assign

A list endpoint's filters get the same treatment as a body: one Zod schema,
wired through `validate(schema, 'query')`, so the controller reads
`c.get('validated')` instead of hand-parsing `c.req.query()` with regexes
and ternaries. But unlike an insert/update schema, **don't** add `.strict()`:

```ts
export const productFilterQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  minPrice: priceStringSchema.optional(),
  deliveryAvailable: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});
export type ProductFilterQuery = z.infer<typeof productFilterQuerySchema>;
```

`.strict()` exists to catch mass-assignment — a client trying to set
`role`/`isActive`/an ownership id through an unexpected body key. A query
string can't do that; it can only ever *read*. An unrecognized param (a
stray `?cursor=` alongside the filters, a client typo) is just noise, safe
to silently drop rather than reject with a 400. Reserve `.strict()` for
`json`-target schemas where unknown keys are an actual risk.

Derive the service method's filter parameter type from this same schema
(`filters?: ProductFilterQuery`) — don't hand-declare a second, structurally
similar interface in the service file. Same reasoning as the
select/insert/update triad above: one shape, one place it's allowed to
drift out of sync (nowhere).

## Match the Zod type to the actual column's wire representation

- Postgres `numeric` columns round-trip as **strings** in JS/Drizzle (to
  avoid float precision loss) — validate them as a regex-matched string,
  not `z.number()`:
  ```ts
  const priceStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);
  ```
- A real float column (`doublePrecision`, e.g. lat/lng stored that way)
  should accept a number (or a numeric string transformed to one) — don't
  reuse the same "numeric-as-string" schema for a column that isn't
  actually `numeric`. The validation shape follows the column type, not a
  single generic "coordinate schema" copy-pasted everywhere.

## Cross-field rules live in `.refine()`, not in an `if` in the controller

```ts
export const insertReportSchema = baseReportSchema.refine(
  (data) => (data.type === 'product') === (data.productId != null),
  { message: 'productId required and only valid when type is "product"', path: ['productId'] }
);
```
This keeps "is this payload internally consistent" at the validation
boundary, with a structured field-level error path for free, instead of
scattered business-logic `if`s.

## Non-CRUD mutations get their own bespoke schema

Don't force a status-change or a checkout or an image-removal endpoint
through `updateXSchema.partial()`. Model the actual input:

```ts
export const updateOrderStatusSchema = z.object({ status: z.enum(['shipped', 'delivered']) }).strict();
export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.number().int().positive() })),
  // no price fields here — the server is authoritative for pricing, see transactions-integrity.md
}).strict();
```
Comment which fields are server-derived vs client-supplied right on the
schema.

## Reusable named schemas for JSONB sub-shapes

Define the shape of a JSONB column's contents once, export it, and reuse it
both as a field override inside the parent's insert schema *and* as the
body schema for any dedicated sub-resource endpoint (e.g. a
`POST /products/:id/images` route):

```ts
export const productImageSchema = z.object({ url: z.string().url(), alt: z.string().optional() });
export const productImagesArraySchema = z.array(productImageSchema).max(10);
```
