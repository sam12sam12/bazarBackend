import { instanceId, publisher, subscriber } from "./redis";

// Fans a chat broadcast out across every backend instance, not just the one
// that handled the triggering request. Bun's own `ws.subscribe()`/
// `server.publish()`/`raw.publish()` pub/sub (used throughout wsRouter.ts)
// only ever reaches sockets connected to *this* process — fine for a single
// instance, silently wrong the moment there's more than one behind a load
// balancer, since a recipient's socket might be on a different instance than
// the sender's. This module is the fix: every place wsRouter.ts used to call
// `raw.publish`/`server.publish` directly now also mirrors that same
// `(topic, payload)` pair through Redis, and every instance (including this
// one) relays it to its own locally-connected sockets.
//
// A minimal structural type, not Bun's own `Server` — the only thing this
// module needs from it is `.publish`, same shape `getBunServer<...>(c)` is
// already cast to in wsRouter.ts.
type Publishable = { publish: (topic: string, data: string) => void };

const FANOUT_CHANNEL = "ws:fanout";

let localServer: Publishable | undefined;

// Called once from server.ts right after `Bun.serve(...)` returns — this
// module has no Hono request context of its own (the Redis subscriber below
// fires on its own, outside any request), so it needs a standing reference
// to the server instead of pulling one from `c.env` the way route handlers
// do.
export function setLocalServer(server: Publishable) {
  localServer = server;
}

// Cross-instance delivery is best-effort on top of local delivery, which
// already happened by the time this is called — a Redis failure here must
// never surface as an unhandled rejection (silently fatal in some runtimes)
// or, worse, propagate up into the caller and fail the message send that
// already succeeded locally. Single instance, no Redis running at all? The
// local `raw.publish`/`server.publish` above already delivered to everyone
// actually connected to this process, which is the only process that
// exists — fan-out degrading to a no-op costs nothing in that case.
function publishFanout(topic: string, payload: string) {
  publisher.publish(FANOUT_CHANNEL, JSON.stringify({ topic, payload, origin: instanceId })).catch((error) => {
    console.error("pubsub: fan-out publish failed (local delivery already happened, unaffected):", error);
  });
}

// The two primitives wsRouter.ts broadcasts through. Each does the local
// delivery exactly as before (same `raw.publish` vs `server.publish` choice,
// same self-exclusion semantics where that mattered) and additionally mirrors
// the message to Redis, tagged with this process's `instanceId`, so every
// *other* instance's subscriber (below) can relay it to its own local
// sockets. The tag is what stops this same instance from double-delivering
// to itself when Redis echoes the publish back to its own subscriber.
export function fanoutFromConnection(raw: { publish: (topic: string, data: string) => void }, topic: string, payload: string) {
  raw.publish(topic, payload);
  publishFanout(topic, payload);
}

export function fanoutBroadcast(topic: string, payload: string) {
  localServer?.publish(topic, payload);
  publishFanout(topic, payload);
}

// Subscribing on `"ready"` (fired on first connect *and* every reconnect),
// not immediately at import time, matters now that `redis.ts` sets
// `enableOfflineQueue: false`: a subscribe issued before the client's
// initial handshake finishes would otherwise reject outright (confirmed
// live — this exact race fired on every single server boot, failing the
// subscription unconditionally, Redis healthy or not) instead of queuing
// the way it used to when offline-queueing was still the default. Binding
// to `"ready"` is also what makes this resubscribe correctly after Redis
// itself restarts, which a one-shot call at import time never would have.
subscriber.on("ready", () => {
  subscriber.subscribe(FANOUT_CHANNEL, (err) => {
    if (err) console.error("pubsub: failed to subscribe to fanout channel:", err);
  });
});

subscriber.on("message", (channel, raw) => {
  if (channel !== FANOUT_CHANNEL) return;

  let parsed: { topic: string; payload: string; origin: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  // Our own publish, echoed back by Redis — already delivered to this
  // instance's local sockets by `fanoutFromConnection`/`fanoutBroadcast`
  // directly, so relaying it again here would double-deliver it.
  if (parsed.origin === instanceId) return;

  localServer?.publish(parsed.topic, parsed.payload);
});
