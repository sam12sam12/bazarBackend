---
name: realtime-chat-system
description: Scaffolds a complete 1:1 real-time chat feature (WebSocket, Postgres-backed messages/conversations, Redis presence + cross-instance fan-out, better-auth session auth, R2/S3 image+voice uploads) into a Bun + Hono + Drizzle + Postgres + Zod backend, matching a specific production reference implementation file-for-file. Trigger on: "add chat to my backend", "set up real-time messaging", "I want the chat system like before", "scaffold the chat feature". Detects what already exists (auth, storage) and only builds what's missing — never duplicates or overwrites a working piece.
---

# Real-time chat system — scaffold

This skill reproduces one specific, already-battle-tested chat implementation
— not a generic "build me a chat feature" improvisation. Every template file
under `templates/` is a verbatim copy of the reference project's real,
working source. The job here is **installation + adaptation**, not
re-design: detect what the target project already has, copy in what's
missing exactly as the templates show it, and wire the pieces together the
same way the reference project does.

Stack assumption: Bun + Hono + Drizzle ORM (Postgres) + Zod. If the target
project uses a materially different stack (Express, Prisma, MySQL), stop and
tell the user this skill assumes Bun/Hono/Drizzle/Postgres — don't attempt a
silent framework translation, that's a different, much riskier task than
"copy this working system in."

## Before writing anything: detect what already exists

Read the target project's structure first (don't guess). Check, in order:

1. **Auth** — does `src/lib/auth.ts` (or equivalent) call `betterAuth(...)`
   with a real session already wired through a middleware
   (`auth.api.getSession`)? Is there a `sessions`/`accounts` table?
2. **Storage** — does a `utils/storage/` (or similarly-named) folder exist
   with a presign/validate/reconcile/sweep shape, or any R2/S3 upload
   pipeline at all?
3. **Redis** — is `ioredis` (or any Redis client) already a dependency and
   wired up anywhere?
4. **Existing chat tables/routes** — do `messages`/`conversations` tables,
   or a `/ws` route, already exist? If so, this is an **update**, not a
   fresh install — diff against the templates instead of overwriting, and
   ask before replacing anything with real data riding on it.

Report findings to the user in one short summary before proceeding if
anything is ambiguous (e.g., "found a `users` table but no uuid id, no
existing auth"). Otherwise proceed directly — this skill is meant to be run
end-to-end without a round trip per file.

## Decision tree

```
Auth missing (no real session anywhere)?
  → Install better-auth exactly as templates/src/lib/auth.ts.
    Needs: templates/src/db/schema/authSchema.ts (sessions/accounts/verifications),
    templates/src/middlewares/authMiddleware.ts, Google env vars.
    Check templates/auth-users-table-requirements.md first — the target
    project's `users` table needs a uuid id + email_verified + an
    avatar/image column for better-auth to reuse it.
  → Already set up?
    Reuse it as-is. Don't touch lib/auth.ts. Just confirm authMiddleware.ts
    (or equivalent) exists and exports something chatRouter/wsRouter can
    import — if the existing auth uses a different session-check shape,
    adapt wsRouter.ts/chatRouter.ts's import to match, don't force in a
    second auth system.

Storage missing (no R2/S3 upload pipeline)?
  → Install the whole templates/src/utils/storage/ folder verbatim
    (client.ts, engine.ts, createStorage.ts, index.ts, README.md), then
    write instance.ts using templates/src/utils/storage/instance.ts as the
    starting point — adapt `getReferencedKeys` to the target project's real
    tables (or drop the `sweep` config entirely if this project has no
    other image-bearing tables yet; chat's own attachments are cleaned up
    directly by chatService.deleteMessage, not by the sweep).
  → Already set up?
    Reuse it. Confirm it exposes something shaped like
    `storage.validateChatImages`/`validateChatVoice`/`reconcileImage`/
    `reconcileImages` (templates/src/utils/storage/createStorage.ts's
    shape) — if its API differs, adapt chatService.ts's calls to match
    rather than installing a second storage system.

Redis missing?
  → Install templates/src/lib/redis.ts, chatHub.ts, pubsub.ts verbatim.

Chat schema/service/routes — always create these (this is the feature
being added):
  → templates/src/db/schema/chatSchema.ts
  → templates/src/db/validation-chat-section.ts (append to db/validation.ts)
  → templates/src/services/chatService.ts
  → templates/src/controllers/chatController.ts
  → templates/src/routes/chatRouter.ts
  → templates/src/routes/wsRouter.ts
  → templates/src/middlewares/rateLimiter.ts (or just add `createRateLimiter`
    to an existing rate limiter file if one's already there)
  → templates/src/middlewares/validator.ts (if no generic Zod-validate
    middleware exists yet)
  → templates/src/utils/pagination.ts, helpers.ts, ApiError.ts, errorUtils.ts
    — only if the target project doesn't already have equivalents. Most
    backends past their first few endpoints already have an ApiError class
    and cursor pagination; don't duplicate, adapt chatService.ts's imports
    to the existing ones instead (same method names/shapes are likely close
    enough — check before assuming a rewrite is needed).
```

## Install order (matters — later steps depend on earlier ones)

1. **`db/schema/_shared.ts`** — confirm a `timestamps` export (created_at/
   updated_at with `precision: 3`) exists; chatSchema.ts spreads it in.
   Create it if missing (see any existing schema file in the target repo
   for the exact shape, or ask the user to paste one).
2. **Auth** (if missing) — schema (`authSchema.ts`), `lib/auth.ts`,
   `middlewares/authMiddleware.ts`. Requires `users` table to meet
   `templates/auth-users-table-requirements.md`'s shape first.
3. **Storage** (if missing) — the whole `utils/storage/` folder.
4. **Redis** (if missing) — `lib/redis.ts`, `lib/chatHub.ts`, `lib/pubsub.ts`.
5. **Chat schema** — `db/schema/chatSchema.ts`, then add
   `export * from './chatSchema'` to `db/schema/index.ts`'s barrel (plus the
   `Conversation`/`ConversationParticipant`/`Message` type exports, same
   pattern as that file's other `$inferSelect` exports). Chat tables are
   **not** added to `db/schema/relations.ts`'s `defineRelations` graph —
   list/pagination queries in chatService.ts stay on `db.select()` with
   explicit joins, same reasoning as every other paginated list in the
   reference project (see its CLAUDE.md's "Drizzle" section if present).
6. **Migration** — `bun run generate && bun run migrate` (or this project's
   equivalent drizzle-kit scripts) right after the schema file lands, before
   writing any code that queries the new tables.
7. **Validation** — append `templates/src/db/validation-chat-section.ts`'s
   contents to `db/validation.ts`.
8. **Service → Controller → Routes** — `chatService.ts`, `chatController.ts`,
   `chatRouter.ts`, `wsRouter.ts`, in that order (each depends on the last).
9. **Rate limiter** — add `createRateLimiter` (wsRouter.ts's message
   send/edit/delete limiter needs it) alongside whatever `rateLimit` Hono
   middleware already exists, or install the whole file if there's none yet.
10. **server.ts wiring** — follow `templates/server-wiring.md` exactly:
    `validateEnv()` call, `/api/auth/*` handler, route mounts, the
    `Bun.serve({ websocket: { ...websocket, idleTimeout: 120 } })` swap,
    `setLocalServer(server)`, graceful shutdown. Export `pool` from
    `db/db.ts` if it isn't already (shutdown needs `pool.end()`).
11. **Env vars** — merge `templates/env-vars.env` into `.env`/`.env.example`,
    skipping whichever group corresponds to a piece that was already present.
12. **Dependencies** — merge `templates/package-deps.json` into
    `package.json`, skipping anything already installed. Run the project's
    install command afterward.
13. **Docker compose** (if the project uses one, or ask if it'd help local
    dev) — merge `templates/docker-compose-snippet.yml`'s `redis` service
    in (and `postgres` too if there's no compose file at all yet).

## Verify before calling it done

Don't just write the files — confirm they actually work, the same way the
reference project's own CLAUDE.md documents verifying chat changes:

1. `bunx tsc --noEmit` (or this project's typecheck script) — zero new
   errors introduced by the new files.
2. Boot the dev server — `validateEnv()` should pass or give a clear missing-
   var message, `checkDatabaseConnection()` should succeed, the process
   shouldn't crash on the `Bun.serve` call.
3. There's no way to curl a WebSocket and no way to get a real signed
   session through a browser-based OAuth flow in a script — use
   better-auth's `testUtils()` plugin (`better-auth/plugins`) in a
   throwaway, **never-committed** script: a second `betterAuth()` instance
   sharing the real schema/secret and the exact same `user`/`session`/
   `account`/`verification` field mappings as the real `lib/auth.ts`,
   `ctx.test.login({ userId })` to mint a real signed session, then
   `fetch`/`new WebSocket(url, { headers: { cookie } })` against the running
   dev server. Confirm at minimum: two users can open `/ws`, send a text
   message to each other, see it arrive live, mark it read, and see the
   read receipt — plus edit/delete if those are in scope. Delete the script
   when done; don't leave verification scripts in the repo.
4. If storage was installed: actually PUT a tiny file to a presigned URL,
   confirm `headObject` sees it, send it as a chat image/voice message,
   delete that message, confirm the R2 object is actually gone.
5. Run the project's test suite if it has one (`bun test`), fix anything
   the new files broke.

## What NOT to do

- Don't invent new protocol frames, endpoints, or schema fields beyond what
  the templates show, even if they seem like reasonable extensions — this
  skill's job is reproducing a known-working system, not redesigning it. If
  the user wants additions (group chat, message reactions, etc.), treat that
  as a separate follow-up request after the base system is installed and
  verified.
- Don't silently change a template's behavior while copying it in (e.g.
  "improving" the rate limit numbers, changing the idempotent-delete
  semantics) — if something about the reference design seems wrong for this
  project, flag it to the user and ask, don't quietly diverge.
- Don't skip the "detect what already exists" step and blindly install
  auth/storage from scratch into a project that already has a working
  version of either — that's how you end up with two competing session
  systems or two storage pipelines.
