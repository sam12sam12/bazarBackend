# server.ts wiring

This project's entry point already exists — don't overwrite it. Merge these
pieces into it in roughly this order.

## Imports to add

```ts
import { websocket } from 'hono/bun'
import { checkDatabaseConnection, pool } from './db/db'   // `pool` must be exported from db/db.ts
import { auth } from './lib/auth'
import { setLocalServer } from './lib/pubsub'
import { publisher, subscriber } from './lib/redis'
import { validateEnv } from './lib/validateEnv'
import chatRouter from './routes/chatRouter'
import uploadRouter from './routes/uploadRouter'          // only if the storage package is being installed too
import wsRouter from './routes/wsRouter'
```

## Near the top, before the Hono app is used for anything

```ts
validateEnv()
```

## Auth handler (outside any versioned prefix like /api/v1)

```ts
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
```

## Route mounts

```ts
app.route('/api/v1/conversations', chatRouter)
app.route('/api/v1/uploads', uploadRouter)   // only if storage is installed
app.route('/ws', wsRouter)
```

## Replace the final `Bun.serve(...)` call

Before:
```ts
const server = Bun.serve({ port: PORT, fetch: app.fetch })
```

After — `websocket` must be handed to Bun alongside `fetch`, or `/ws`
upgrades the connection and then goes silent; `idleTimeout` bounds how
stale presence can get if a connection dies without a clean close:

```ts
const server = Bun.serve({ port: PORT, fetch: app.fetch, websocket: { ...websocket, idleTimeout: 120 } })
setLocalServer(server)
```

## Graceful shutdown (append after the `Bun.serve` call)

```ts
let shuttingDown = false
async function shutdown(signal: string) {
	if (shuttingDown) return
	shuttingDown = true
	console.log(`\n${signal} received, shutting down gracefully...`)

	await server.stop()
	await pool.end()
	publisher.disconnect()
	subscriber.disconnect()

	console.log('✅ Shutdown complete')
	process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

If this project doesn't already have `checkDatabaseConnection()` /
`await checkDatabaseConnection()`, add that too, before the routes are
mounted — it's what makes `validateEnv`'s companion fail-fast posture
complete (bad DB creds surface at boot, not on the first request).

## db/db.ts — `pool` must be exported, not just `db`

```ts
export const pool = new Pool({ ... })   // was: const pool = ...
```

Needed for the graceful shutdown above (`pool.end()`).
