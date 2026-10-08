# Auth, authorization & middleware pipeline

## Cache expensive session/token lookups in-process with a TTL

If verifying a session/token requires a DB hit or a call into an auth
library, and it runs on effectively every authenticated request, front it
with a short-lived in-memory cache:

```ts
const SESSION_TTL = 60_000;
const cache = new Map<string, { data: Session; expiresAt: number }>();
setInterval(() => { // periodic sweep so the Map doesn't grow unbounded
  const now = Date.now();
  for (const [key, v] of cache) if (v.expiresAt < now) cache.delete(key);
}, SESSION_TTL);

async function resolveSession(token: string) {
  const hit = cache.get(token);
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  const session = await verifySessionFromAuthProvider(token);
  cache.set(token, { data: session, expiresAt: Date.now() + SESSION_TTL });
  return session;
}
```
This "Map + periodic sweep interval" idiom is the default for any cheap,
single-process, TTL'd state (session cache, rate limiting) — reach for
Redis only once you actually need it shared across processes.

## Layered auth middleware, composed in a fixed order

- `authMiddleware` — require a valid session, 401 if absent, sets
  `c.set('user', ...)`.
- `optionalAuth` — attaches the user if a session is present, never blocks.
  Use on public routes whose behavior changes when logged in (e.g. "is this
  favorited by me").
- `adminMiddleware` — must run **after** `authMiddleware`. It trusts that a
  user is already set and only checks `user.role === 'admin'`, throwing
  `ApiError.forbidden()` otherwise. Always mount these two together in one
  `.use()` call so the order can't accidentally be split apart later:
  ```ts
  dashboardRouter.use('*', authMiddleware, adminMiddleware);
  ```

## Default policy as one middleware, mounted globally, overridden per router

Encode the app-wide default ("reads are public, writes require auth") as a
single middleware checked against an HTTP-method allowlist, mounted once on
the whole API surface:

```ts
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export async function mutationAuth(c: Context, next: Next) {
  if (SAFE_METHODS.has(c.req.method)) return next();
  return authMiddleware(c, next);
}
app.use('/api/v1/*', mutationAuth);
```
Individual routers then tighten further where the default is wrong for
them: add `authMiddleware` on specific user-scoped read routes (e.g. "my
orders"), or require auth+admin on *every* method (including GET) for an
admin-only surface. This "global default → router-level tightening →
route-level tightening" layering means most routers need zero boilerplate,
and the handful that need stricter rules say so explicitly at their mount
point.

## Ownership check shape

Always a single boolean short-circuit, admin bypass as the second clause:

```ts
if (resource.ownerId !== user.id && user.role !== 'admin') {
  throw ApiError.forbidden('You do not own this resource');
}
```
Not a separate `if (isAdmin) return` early-exit — keeping it as one
expression makes every ownership check in the codebase visually identical
and easy to audit by grepping for the pattern.

## Normalize requests once, at the edge — not field-by-field in every schema

If every string input should be trimmed, do it once in a middleware that
wraps the request's body/query/param accessors, so neither Zod schemas nor
controllers need to call `.trim()` themselves:

```ts
app.use('*', trimMiddleware); // deep-trims json body, form body, query, and params transparently
```
This is a structurally better choice than adding `.trim()` to every
relevant Zod field one at a time — one place to fix, one place to verify.

## Rate limiting

Hand-rolled in-memory (`Map<ip, { count, resetAt }>` + a sweep interval) is
fine and simpler than a library for a single-process deployment — scope it
to the routes that actually need it (auth endpoints are the classic
target), not globally.

## Startup ordering

- Register error/observability middleware (Sentry or equivalent) **first**,
  before anything else, so it wraps every downstream middleware and never
  misses an error.
- Verify the DB connection before the server starts accepting traffic —
  fail fast instead of serving requests that are guaranteed to error.
- Mount a non-versioned auth handler (if using something like better-auth)
  completely outside your versioned API middleware stack (`/api/auth/*`
  separate from `/api/v1/*`) so it isn't accidentally subject to your
  default API auth policy.
