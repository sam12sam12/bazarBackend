# Afghan Bazar — Backend

## Stack

- **Runtime**: Bun (native TypeScript, no build step)
- **Framework**: Hono
- **Database**: PostgreSQL via Drizzle ORM
- **Validation**: Zod + `drizzle-zod`
- **Auth**: better-auth (Google OAuth only — no email/password, no magic-link)
- **Linter**: Biome (`@biomejs/biome`)

## Architecture: Controller → Service → DB

```
src/routes/        → Hono router, mounts middleware and controllers
src/controllers/   → Parse request, validate with Zod, call service, return JSON
src/services/      → All business logic and Drizzle queries
src/db/schema/     → Drizzle table definitions
src/db/validation.ts → Zod schemas (built from drizzle-zod + custom)
src/lib/auth.ts    → better-auth config
src/middlewares/   → authMiddleware (required) + optionalAuth
```

Controllers must stay thin. No query logic in controllers — that belongs in services.

## Auth

better-auth with Google OAuth only. Three required tables: `users`, `session`, `account`.

- The `verification` table has been removed — do not add it back unless adding email-based flows.
- Auth requests go straight to better-auth's own handler, mounted at `/api/auth/*` (not under `/api/v1`) — e.g. native Google sign-in calls `POST /api/auth/sign-in/social` with `{ provider: "google", idToken: { token } }`. Do not add custom wrapper endpoints for this; call better-auth's handler/client directly.
- Sessions use bearer tokens. Protect routes with `authMiddleware`, use `optionalAuth` for public routes that change behavior when logged in.
- User and session are available in Hono context as `c.get('user')` and `c.get('session')` after middleware.

## Validation

- All POST/PUT/PATCH payloads must be validated with Zod in `src/db/validation.ts`.
- Use `drizzle-zod`'s `createInsertSchema` / `createSelectSchema` as base, then extend with `.pick()`, `.omit()`, or `.extend()` for endpoint-specific rules.
- Auth-specific schemas live in `src/db/validation.ts` (e.g. `googleAuthSchema`).

## Database

- **Never run `bun run gen` or `bun run mig`.** The user runs these themselves. If a schema change needs a migration, tell the user what changed and let them generate/apply it.
- The DB was historically set up via `drizzle-kit push`; always check the migration history before applying.
- Categories use PostgreSQL `ltree` for hierarchical trees.
- Products store images and specs in `JSONB` columns — use atomic operators for partial JSONB updates.
- Afghan market specifics: pricing supports `AFN`, `USD`, and `PKR`. Phone numbers (`users.phone`, `addresses.phone`, `stores.contact_phone`/`secondary_phone`/`whatsapp`) are validated as general E.164 (`+` then 7-15 digits, no leading 0) — not Afghanistan-only — since the frontend's `PhoneInput` lets a user pick any country from `src/utils/constants/countries.ts` and always sends the full `+<dialcode><number>` string.
- `content_version` is a single-row table holding one monotonic integer, bumped via `contentVersionService.bumpVersion(tx)` inside the same transaction whenever `dashboardService` creates/updates/deletes a category, category attribute, or province. Read it with `contentVersionService.getVersion()` (exposed at `GET /api/v1/meta/version`) — mobile clients compare it to their cached value to decide whether to refetch.

## Scripts

```bash
bun run dev    # Start with file watching
bun run gen    # Generate Drizzle migration
bun run mig    # Apply migrations (needs TTY)
bun run stud   # Drizzle Studio
bun run seed.ts  # Seed mock data
```

## Routes

```
/api/auth/*         → better-auth's own handler (session/social sign-in — not versioned, not under /api/v1)
/api/v1/users       → userRouter
/api/v1/stores      → storeRouter
/api/v1/products    → productRouter
/api/v1/product-requests → productRequestRouter
/api/v1/orders      → orderRouter
/api/v1/addresses   → addressRouter
/api/v1/banners     → bannerRouter
/api/v1/notifications → notificationRouter
/api/v1/reports     → reportRouter
/api/v1/product-reviews → productReviewRouter
/api/v1/store-reviews   → storeReviewRouter
/api/v1/dashboard   → dashboardRouter (admin-only; also owns category/attribute/province reads + writes — see below)
/api/v1/meta        → metaRouter (app-version, content version, and the categories+attributes+provinces bundle mobile clients use)
```

Categories, category attributes, and provinces have no public router of their own. Mobile clients read them from `GET /api/v1/meta` (bundle) and `GET /api/v1/meta/version` (cache probe); `categoryController`/`provinceController` are mounted only under `/api/v1/dashboard` (admin-only) for browsing in the admin UI, alongside the existing create/update/delete routes there.

## Response Shape

Always return:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "..." }
```

Use `ApiError` from `src/utils/ApiError.ts` for structured error throwing in services.
