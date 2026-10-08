// Fans a chat broadcast out across every backend instance, not just the one
// that handled the triggering request. Bun's own `ws.subscribe()`/
// `server.publish()`/`raw.publish()` (used throughout `wsRouter.ts`) only
// ever reaches sockets connected to *this* process — fine for a single
// instance, silently wrong the moment there's more than one behind a load
// balancer, since a recipient's socket might be on a different instance
// than the sender's. Every call site in `wsRouter.ts` goes through
// `fanoutFromConnection`/`fanoutBroadcast` by name, never the bare Bun
// method directly, which is what makes this file the only thing that had to
// change to add that cross-instance mirror — no caller edits.
import { instanceId, publisher, subscriber } from './redis'

type Publishable = { publish: (topic: string, data: string) => void }

const FANOUT_CHANNEL = 'ws:fanout'

let localServer: Publishable | undefined

// Called once from `server.ts` right after `Bun.serve(...)` returns —
// `fanoutBroadcast` has no per-request context of its own (it's invoked
// from inside `onClose`/`onOpen` handlers reacting to presence changes, not
// from a route), so it needs a standing reference to the server instance
// instead of pulling one out of `c.env`.
export function setLocalServer(server: Publishable) {
	localServer = server
}

// Cross-instance delivery is best-effort on top of local delivery, which
// already happened by the time this is called — a Redis failure here must
// never surface as an unhandled rejection or propagate up into the caller
// and fail the message send that already succeeded locally. Single
// instance, no Redis running at all? The local `raw.publish`/
// `server.publish` below already delivered to everyone actually connected
// to this process, which is the only process that exists — fan-out
// degrading to a no-op costs nothing in that case.
function publishFanout(topic: string, payload: string) {
	publisher
		.publish(
			FANOUT_CHANNEL,
			JSON.stringify({ topic, payload, origin: instanceId }),
		)
		.catch((error) => {
			console.error(
				'fanout: cross-instance publish failed (local delivery already happened, unaffected):',
				error,
			)
		})
}

// Publishes via the connection that triggered it — Bun's `raw.publish`
// excludes that exact connection by default, so the sender's *other* open
// devices receive it through the room while the sender's own connection is
// reconciled separately via a direct `ws.send(...)` in `wsRouter.ts`.
// Additionally mirrors the message to Redis, tagged with this process's
// `instanceId`, so every *other* instance's subscriber (below) can relay it
// to its own local sockets.
export function fanoutFromConnection(
	raw: { publish: (topic: string, data: string) => void },
	topic: string,
	payload: string,
) {
	raw.publish(topic, payload)
	publishFanout(topic, payload)
}

// Publishes to everyone subscribed to `topic`, including the triggering
// connection if it's a member — used where there's no single "sender"
// connection to exclude (e.g. presence changes fired from `onClose`, after
// the connection is already gone). Also mirrored to Redis, same as above.
export function fanoutBroadcast(topic: string, payload: string) {
	localServer?.publish(topic, payload)
	publishFanout(topic, payload)
}

// Subscribing on `"ready"` (fired on first connect *and* every reconnect),
// not immediately at import time, matters with `redis.ts`'s
// `enableOfflineQueue: false`: a subscribe issued before the client's
// initial handshake finishes would otherwise reject outright instead of
// queuing the way it used to when offline-queueing was still the default.
// Binding to `"ready"` is also what makes this resubscribe correctly after
// Redis itself restarts, which a one-shot call at import time never would.
subscriber.on('ready', () => {
	subscriber.subscribe(FANOUT_CHANNEL, (err) => {
		if (err)
			console.error('fanout: failed to subscribe to fanout channel:', err)
	})
})

subscriber.on('message', (channel, raw) => {
	if (channel !== FANOUT_CHANNEL) return

	let parsed: { topic: string; payload: string; origin: string }
	try {
		parsed = JSON.parse(raw)
	} catch {
		return
	}

	// Our own publish, echoed back by Redis — already delivered to this
	// instance's local sockets by `fanoutFromConnection`/`fanoutBroadcast`
	// directly, so relaying it again here would double-deliver it.
	if (parsed.origin === instanceId) return

	localServer?.publish(parsed.topic, parsed.payload)
})
