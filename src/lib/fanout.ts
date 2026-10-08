// Single-instance pub/sub fan-out for chat. Bun's own `ws.subscribe()`/
// `server.publish()`/`raw.publish()` (used throughout `wsRouter.ts`) only
// ever reaches sockets connected to *this* process, which is exactly right
// for one instance and silently wrong the moment a second instance exists
// behind a load balancer. This file is the seam for that future: every call
// site in `wsRouter.ts` goes through `fanoutFromConnection`/
// `fanoutBroadcast` by name, never the bare Bun method directly — so
// upgrading to a Redis-mirrored version later (see the reference
// implementation's `lib/pubsub.ts`) only means rewriting this file's
// bodies, not any caller.
type Publishable = { publish: (topic: string, data: string) => void }

let localServer: Publishable | undefined

// Called once from `server.ts` right after `Bun.serve(...)` returns —
// `fanoutBroadcast` has no per-request context of its own (it's invoked
// from inside `onClose`/`onOpen` handlers reacting to presence changes, not
// from a route), so it needs a standing reference to the server instance
// instead of pulling one out of `c.env`.
export function setLocalServer(server: Publishable) {
	localServer = server
}

// Publishes via the connection that triggered it — Bun's `raw.publish`
// excludes that exact connection by default, so the sender's *other* open
// devices receive it through the room while the sender's own connection is
// reconciled separately via a direct `ws.send(...)` in `wsRouter.ts`.
export function fanoutFromConnection(
	raw: { publish: (topic: string, data: string) => void },
	topic: string,
	payload: string,
) {
	raw.publish(topic, payload)
}

// Publishes to everyone subscribed to `topic`, including the triggering
// connection if it's a member — used where there's no single "sender"
// connection to exclude (e.g. presence changes fired from `onClose`, after
// the connection is already gone).
export function fanoutBroadcast(topic: string, payload: string) {
	localServer?.publish(topic, payload)
}
