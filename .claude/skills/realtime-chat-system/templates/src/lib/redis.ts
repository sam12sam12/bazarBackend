import { randomUUID } from "crypto";
import Redis from "ioredis";

// Two connections, not one — ioredis puts a client in subscriber mode the
// moment it calls `.subscribe()`, and a connection in subscriber mode can
// only issue pub/sub commands (no PUBLISH, no INCR/DECR/EXISTS for
// presence). `publisher` is the general-purpose client every other module
// in `lib/`/`routes/`/`services/` reaches for; `subscriber` exists only for
// pubsub.ts's `fanoutChannel` subscription.
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// `enableOfflineQueue: false` is the one setting that actually matters here
// — ioredis's default is to *queue* commands indefinitely while
// disconnected/reconnecting rather than reject them, which means `await
// publisher.incr(...)` (chatHub.ts's presence, pubsub.ts's fanout) would
// hang forever — not error, hang — for as long as Redis stays unreachable.
// Confirmed live: a presence call left hanging for 5+ seconds with no
// resolution against a dead Redis. With this set, a command issued while
// disconnected rejects immediately instead, which is what lets
// chatHub.ts/pubsub.ts fail soft (chat keeps working, presence/fan-out just
// silently no-ops) instead of stalling the WebSocket's `onOpen` handler —
// and by extension every new connection — indefinitely.
export const publisher = new Redis(REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
export const subscriber = new Redis(REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });

// Identifies *this* process among however many backend instances are
// running behind the load balancer. Generated once per process start, never
// persisted — only used so pubsub.ts can tell "a fanout message this same
// process just published" apart from "a fanout message some other instance
// published," which is what stops a message from being delivered twice to
// this instance's own sockets (see pubsub.ts's comment).
export const instanceId = randomUUID();

publisher.on("error", (err) => console.error("redis(publisher) error:", err));
subscriber.on("error", (err) => console.error("redis(subscriber) error:", err));
