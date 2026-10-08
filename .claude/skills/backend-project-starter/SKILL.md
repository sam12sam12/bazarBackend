---
name: backend-project-starter
description: Scaffolds a brand-new Bun + Hono + Drizzle + Postgres + Zod backend project — the exact folder structure, middlewares, and helpers from the reference backend, with authentication (better-auth) and storage (R2/S3 presigned uploads) fully wired, plus exactly ONE example schema (a worked end-to-end vertical slice, not a real domain table) to prove everything works. Installs the reference project's package.json dependencies. Trigger on: "start a new backend project", "create a new project like this one", "scaffold a new Hono/Drizzle backend", "set up a new project with auth and storage". If the request mentions chat/real-time messaging, hand off to the realtime-chat-system skill to add it on top — otherwise the result is auth + storage + one example schema only, no chat.
---

# Backend project starter — scaffold

This skill reproduces the reference backend's *skeleton* — not a feature.
Where `realtime-chat-system` installs one known feature into an existing
project, this skill creates a **new project from nothing**: folder
structure, every generic middleware/helper, auth, storage, and one example
schema so the whole chain (session → DB → ownership check → response) is
provably working before any real domain tables get added.

Stack: Bun + Hono + Drizzle ORM (Postgres) + Zod + better-auth. If the user
asks for a different stack (Express, Prisma, MySQL, Next.js API routes),
stop and say this skill assumes Bun/Hono/Drizzle/Postgres — don't attempt a
silent framework translation.

Every file under `templates/` is copy-ready source, not pseudocode — most
are verbatim copies of the reference backend's real, generic files; a few
(`server.ts`, `db/validation.ts`, `db/schema/{exampleSchema,relations,index}.ts`,
`utils/storage/instance.ts`, the `user*`/`example*` controllers/services/routes)
are this starter's own minimal, from-scratch versions, written to match the
same conventions.

## Before writing anything

1. Confirm the target is empty or near-empty (no existing `src/`, no
   existing `package.json` with its own backend deps). If the target
   already has a backend of its own, this is the wrong skill — point the
   user at `realtime-chat-system` (to add chat) or `backend-architect` (to
   add a new resource to an existing backend) instead.
2. Ask (if not already stated) where the new project should be created —
   a path, or "right here" if the directory is genuinely empty.
3. Check whether the request mentions chat / real-time messaging anywhere
   ("include chat", "with messaging", "like before", "the chat system
   too"). This decides step 6 below. If chat isn't mentioned, the result
   is **auth + storage + one example schema, full stop** — don't add chat,
   don't add a second example schema, don't add extra routes "while we're
   at it".

## Install order

1. **Project root** — copy `templates/config/package.json`,
   `tsconfig.json`, `drizzle.config.ts`, `docker-compose.yml` into the new
   project root. Copy `env.example` → `.env.example` and `gitignore` →
   `.gitignore` (renamed because this skill's own `templates/` folder can't
   contain a literal `.env`/`.gitignore` without affecting this repo).
2. **`src/db/schema/_shared.ts`, `userSchema.ts`, `authSchema.ts`** — copy
   verbatim. These three always come first; everything else FKs into
   `users`.
3. **`src/db/schema/exampleSchema.ts`** — copy verbatim. This is the ONE
   schema this skill creates. Do not add more tables here — if the user's
   startup description names a real domain ("a products table", "orders"),
   that's a separate follow-up task for `backend-architect` after this
   skill finishes, not something to fold into this run.
4. **`src/db/schema/relations.ts`, `index.ts`** — copy verbatim (they
   already wire up exactly `users` + `items`).
5. **`src/db/db.ts`** — copy verbatim.
6. **`src/lib/auth.ts`, `validateEnv.ts`** — copy verbatim. Open `auth.ts`
   and replace the `"myapp://"` placeholder in `trustedOrigins` with the
   real client's deep-link scheme once known (or ask the user); drop the
   whole array if the client is web-only.
7. **`src/middlewares/authMiddleware.ts`, `rateLimiter.ts`, `validator.ts`**
   — copy verbatim.
8. **`src/utils/ApiError.ts`, `errorUtils.ts`, `helpers.ts`, `pagination.ts`**
   — copy verbatim.
9. **`src/utils/storage/`** — copy `client.ts`, `engine.ts`,
   `createStorage.ts`, `index.ts`, `README.md` verbatim; copy `instance.ts`
   as its own starter version (no `sweep` config — nothing has an image
   column yet). This is "storage setup" — don't skip it even though the one
   example schema has no image field; it's there so the next real table
   that needs one just adds a `sweep.getReferencedKeys` query, not a whole
   pipeline.
10. **`src/db/validation.ts`** — copy verbatim (presign + item schemas).
11. **`src/services/userService.ts`, `controllers/userController.ts`,
    `routes/userRouter.ts`** — copy verbatim. This is the minimal proof
    that a real session resolves to a real `users` row (`GET /api/v1/users/me`).
12. **`src/services/exampleService.ts`, `controllers/exampleController.ts`,
    `routes/exampleRouter.ts`, `routes/uploadRouter.ts`** — copy verbatim.
13. **`src/server.ts`** — copy verbatim (mounts `/api/auth/*`,
    `/api/v1/users`, `/api/v1/uploads`, `/api/v1/items`; no WebSocket
    wiring).
14. **`.env`** — copy from the just-created `.env.example`, then fill in
    real values: `DATABASE_URL` (matches `docker-compose.yml`'s postgres
    service by default), `BETTER_AUTH_SECRET` (`bunx better-auth secret`),
    `BETTER_AUTH_URL`, Google OAuth client id(s), R2 credentials. The
    process refuses to boot without these (`validateEnv.ts`) — don't skip
    straight to `bun install` and expect `bun run dev` to work without
    them.
15. **Dependencies** — run this project's install command (`bun install`)
    against `templates/config/package.json`'s dependency list, copied in
    at step 1. This is "the packages I have installed" from the user's
    request — the same deps as the reference backend, minus `ioredis`
    (only needed if chat gets added in step 16).
16. **Migration** — `bun run generate && bun run migrate` (or
    `drizzle-kit push` for a quick local spike) once the schema files are
    in place, before booting the server.
17. **Chat (only if the trigger in step 3 matched)** — invoke the
    `realtime-chat-system` skill now, against this freshly-created project.
    It will detect that auth and storage already exist (from steps 6 and
    9) and build only what's missing: Redis, the chat schema/service/
    controller/routes, and the `server.ts` WebSocket wiring. Don't
    hand-roll any of that here — this skill's job stops at "auth + storage
    + one example schema," chat is entirely that other skill's job.

## Verify before calling it done

1. `bunx tsc --noEmit` — zero errors.
2. `bun run dev` — `validateEnv()` passes (or gives a clear missing-var
   message), `checkDatabaseConnection()` succeeds, the process doesn't
   crash on `Bun.serve`.
3. `curl localhost:8000/` → `{"status":"ok",...}`.
4. Confirm `/api/v1/items` and `/api/v1/users/me` both return 401 without a
   session (proves `authMiddleware` is actually wired, not just present).
   A full sign-in round-trip needs a real OAuth flow or better-auth's
   `testUtils()` plugin in a throwaway, never-committed script — same
   approach as `realtime-chat-system`'s verification step.
5. If storage env vars are filled in: actually hit `POST /api/v1/uploads/presign`
   with a session and confirm it returns a signed URL.

## What NOT to do

- Don't create more than one example schema. "Just for test" means exactly
  one worked vertical slice — enough to prove the pattern, not a starter
  product catalog.
- Don't add chat, Redis, or any WebSocket wiring unless the user's request
  actually mentioned chat/real-time messaging — that's the
  `realtime-chat-system` skill's job, invoked as its own step, not
  improvised inline here.
- Don't invent additional middlewares, routes, or "nice to have" scaffolding
  beyond what's listed above, even if it seems like a reasonable default for
  a new project — this skill reproduces a known skeleton, it doesn't expand
  on it.
- Don't skip the "confirm target is empty" check and overwrite an existing
  project's files.
