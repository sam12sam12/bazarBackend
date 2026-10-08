# Error handling & response shaping

## One `ApiError` class, static factories per status, always thrown through them

```ts
export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public errors?: unknown) { super(message); }
  static badRequest(msg: string, errors?: unknown) { return new ApiError(400, msg, errors); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg: string) { return new ApiError(409, msg); }
  static internal(msg = 'Internal Server Error') { return new ApiError(500, msg); }
}
```
Services and controllers throw via these factories exclusively — never a
bare `throw new Error(...)`, never construct error JSON by hand.

## One global error handler is the only place that builds an error response

Controllers and services only ever `return c.json({ success: true, data })`
for the happy path. Every error path funnels through a single `app.onError`
with a strict three-tier triage:

```ts
app.onError((err, c) => {
  if (err instanceof ApiError) {
    // expected, application-level error — log if useful, but don't page anyone
    return c.json({ success: false, message: err.message }, err.statusCode);
  }
  const dbError = handleDatabaseError(err); // known Postgres constraint violation
  if (dbError) {
    return c.json({ success: false, message: dbError.message }, dbError.statusCode);
  }
  // truly unexpected — this is the only branch worth alerting on
  captureException(err);
  return c.json({ success: false, message: 'Internal Server Error' }, 500);
});
```
The comment worth keeping verbatim in real code: only the third branch is
unexpected enough to be worth paging someone about. Known `ApiError`s and
known DB constraint violations are part of normal operation, not incidents.

## Defensively unwrap driver errors before reading `.code`

ORM/driver/connection-pool layers wrap the underlying Postgres error
inconsistently depending on the failure path. Don't assume one fixed shape:

```ts
function unwrap(err: any) {
  while (err?.cause || err?.originalError || err?.driverError) {
    err = err.cause ?? err.originalError ?? err.driverError;
  }
  return err;
}

function handleDatabaseError(err: unknown) {
  const raw = unwrap(err);
  if (raw?.code === '23505') { // unique_violation
    if (raw.constraint === 'product_reviews_user_product_idx') {
      return { statusCode: 409, message: 'You have already reviewed this product.' };
    }
    const field = /key \((.*?)\)=/.exec(raw.detail ?? '')?.[1];
    return { statusCode: 409, message: field ? `${field} already exists.` : 'Already exists.' };
  }
  if (raw?.code === '23503') return { statusCode: 404, message: 'Related resource not found.' };
  return null; // not a recognized DB error — let the caller treat it as unexpected
}
```
Layer the mapping: specific known constraint name → parsed field name from
the driver's `detail` string → generic fallback. Never surface the raw
Postgres error message to the client.

## Malformed JSON is a clean 400, distinct from a Zod shape failure

The validation middleware should wrap `c.req.json()` itself in a try/catch,
so "not valid JSON at all" and "valid JSON but wrong shape" get different
diagnostic messages, both still 400s:

```ts
export function validate(schema: ZodSchema, target: 'json' | 'query' | 'param' = 'json') {
  return async (c: Context, next: Next) => {
    let body;
    try { body = target === 'json' ? await c.req.json() : /* ... */; }
    catch { throw ApiError.badRequest('Invalid request format'); }
    const result = schema.safeParse(body);
    if (!result.success) throw ApiError.badRequest('Validation failed', z.flattenError(result.error));
    c.set('validated', result.data);
    await next();
  };
}
```

## One consistent success envelope

```json
{ "success": true, "data": { "...": "..." } }
{ "success": false, "message": "..." }
```
For paginated lists, nest pagination metadata **inside** `data`, on every
single paginated endpoint, with no exceptions:

```json
{ "success": true, "data": { "items": [...], "nextCursor": "...", "hasMore": true } }
```
Pick this shape once and enforce it everywhere — don't let one resource put
`nextCursor` as a sibling of `data` while another nests it inside. That kind
of drift forces every API consumer to special-case each endpoint.

## Cursors are opaque, minimal, and fail soft

Encode only the sort tuple the query needs (`{ created_at, id }`), as a
single opaque string passed back as one `?cursor=` query param — never a
raw page number or offset. If a cursor fails to parse (malformed, tampered,
stale), treat it as absent (start from the beginning) rather than throwing
— a bad cursor should degrade gracefully, not break the client.

## Flag trust boundaries with a comment where they matter

Anywhere server-computed or server-derived data is written — a price
total, a role, an ownership id pulled from the session instead of the body
— leave a one-line comment at that exact write site
(`// server-computed, never trusted from client`). It costs nothing and
means a future reader doesn't have to reconstruct the security reasoning
by reading the whole call chain.
