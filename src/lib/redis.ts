import Redis from 'ioredis'

// Two connections, not one — ioredis puts a client in subscriber mode the
// moment it calls `.subscribe()`, and a connection in subscriber mode can
// only issue pub/sub commands (no PUBLISH, no INCR/DECR/MGET for presence).
// `publisher` is the general-purpose client fanout.ts/presence.ts reach for;
// `subscriber` exists only for fanout.ts's channel subscription.
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// `enableOfflineQueue: false` is the one setting that actually matters here
// — ioredis's default is to *queue* commands indefinitely while
// disconnected/reconnecting rather than reject them, which would make
// `await publisher.incr(...)` (presence.ts) or a fan-out publish
// (fanout.ts) hang forever — not error, hang — for as long as Redis stays
// unreachable. With this set, a command issued while disconnected rejects
// immediately instead, which is what lets presence.ts/fanout.ts fail soft
// (chat keeps working, presence/fan-out just silently no-ops) instead of
// stalling the WebSocket's `onOpen` handler, and by extension every new
// connection, indefinitely.
export const publisher = new Redis(REDIS_URL, {
	enableOfflineQueue: false,
	maxRetriesPerRequest: 1,
})
export const subscriber = new Redis(REDIS_URL, {
	enableOfflineQueue: false,
	maxRetriesPerRequest: 1,
})

// Identifies *this* process among however many backend instances are
// running behind a load balancer. Generated once per process start, never
// persisted — only used so fanout.ts can tell "a fanout message this same
// process just published" apart from "a fanout message some other instance
// published," which is what stops a message from being delivered twice to
// this instance's own sockets.
export const instanceId = crypto.randomUUID()

publisher.on('error', (err) => console.error('redis(publisher) error:', err))
subscriber.on('error', (err) => console.error('redis(subscriber) error:', err))
