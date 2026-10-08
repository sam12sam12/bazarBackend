// Cluster-wide presence registry for chat. "Online" means "at least one
// websocket, on any backend instance, is open for this user right now" —
// it's never written to Postgres on purpose, since it has no meaning beyond
// the lifetime of a live connection and nothing about it needs to survive a
// restart or be queried historically.
//
// Backed by Redis (not an in-memory Map) so this answer is correct when
// more than one backend instance is running behind a load balancer — a
// user's two devices can land on two different instances, and "is this user
// online" has to be true as long as *either* connection is open, not just
// the one this process happens to know about. Each key is a plain
// connection counter (`presence:{userId}` → number of open sockets for that
// user, across every instance) so a second device/tab doesn't flip the user
// offline when only one of their connections closes.
//
// Room membership (who's subscribed to which conversation) isn't tracked
// here — Bun's own `ws.subscribe()`/`server.publish()` pub/sub already owns
// that per-process; see `fanout.ts` for how a publish on one instance
// reaches sockets connected to a different one.
import { publisher } from './redis'

const presenceKey = (userId: string) => `presence:${userId}`

// Every presence key carries this TTL, refreshed on every register and
// every heartbeat (see `refreshConnection` and wsRouter.ts's
// `presence:heartbeat` frame). This is the self-healing half of presence:
// a clean disconnect still deletes the key immediately via
// `unregisterConnection`, but a connection that dies *without* one (app
// killed, battery died, network dropped) stops sending heartbeats and the
// key simply expires on its own within this window instead of leaking
// "online" forever. 45s is 2-3 missed ~20s client heartbeats' worth of
// slack — long enough that a single dropped heartbeat frame doesn't flap
// someone offline, short enough that a real crash self-corrects quickly.
const PRESENCE_TTL_SECONDS = 45

// Presence is a nice-to-have overlay on top of chat (online dot, delivered-
// vs-sent ticks), not something a message send/receive should ever depend
// on — so every function here fails soft, not loud, when Redis is
// unreachable. This matters concretely in `wsRouter.ts`'s `onOpen`: these
// calls are awaited directly before the connection's `ready` frame is ever
// sent, so letting a Redis error propagate would stall every new
// connection, not just degrade presence for this one. Logged once per
// failure so an outage is visible in the logs without spamming it per call.
let loggedRedisFailure = false
function logRedisFailureOnce(context: string, error: unknown) {
	if (loggedRedisFailure) return
	loggedRedisFailure = true
	console.error(
		`presence: Redis unavailable, presence disabled until it recovers (first failure in ${context}):`,
		error,
	)
}

// Returns true only on a user's *first* open connection cluster-wide (i.e.
// they just came online) — a second tab/device shouldn't re-announce
// "online". Returns `false` (never announce) if Redis is down.
export async function registerConnection(userId: string): Promise<boolean> {
	try {
		const count = await publisher.incr(presenceKey(userId))
		await publisher.expire(presenceKey(userId), PRESENCE_TTL_SECONDS)
		loggedRedisFailure = false
		return count === 1
	} catch (error) {
		logRedisFailureOnce('registerConnection', error)
		return false
	}
}

// Called on every `presence:heartbeat` frame (wsRouter.ts) from any of a
// user's open connections — keeps the counter's TTL from expiring while at
// least one connection is genuinely still alive and checking in. Fails
// soft like everything else here: a missed refresh under a Redis blip just
// means the key expires a little early, which only ever self-corrects
// *toward* "offline," never produces a false "online."
export async function refreshConnection(userId: string): Promise<void> {
	try {
		await publisher.expire(presenceKey(userId), PRESENCE_TTL_SECONDS)
		loggedRedisFailure = false
	} catch (error) {
		logRedisFailureOnce('refreshConnection', error)
	}
}

// Returns true only on a user's *last* open connection cluster-wide (i.e.
// they just went offline). Returns `false` if Redis is down — nothing to
// clean up or announce if the count was never actually incremented.
export async function unregisterConnection(userId: string): Promise<boolean> {
	try {
		const count = await publisher.decr(presenceKey(userId))
		loggedRedisFailure = false
		if (count <= 0) {
			// Clean up rather than leave a `0` key lying around — also guards
			// against the count ever drifting negative (e.g. a stray
			// unregister without a matching register after a bad deploy)
			// permanently wedging this user as "offline" once a real
			// connection does increment it back up from a negative number
			// instead of from zero.
			await publisher.del(presenceKey(userId))
			return true
		}
		// Other connections for this user are still open — their own
		// heartbeats keep the TTL fresh regardless, but re-arming it here
		// too costs nothing and avoids relying on the timing of whichever
		// heartbeat happens to land next.
		await publisher.expire(presenceKey(userId), PRESENCE_TTL_SECONDS)
		return false
	} catch (error) {
		logRedisFailureOnce('unregisterConnection', error)
		return false
	}
}

// The one call site that reads presence (wsRouter.ts's `ready` frame) needs
// "which of these contacts are online," plural, not one user at a time —
// a single `MGET` instead of N round-trips. Returns `[]` (nobody known
// online, rather than blocking the caller) if Redis is down.
export async function getOnlineUserIds(userIds: string[]): Promise<string[]> {
	if (userIds.length === 0) return []
	try {
		const values = await publisher.mget(userIds.map(presenceKey))
		loggedRedisFailure = false
		return userIds.filter((_, i) => values[i] != null)
	} catch (error) {
		logRedisFailureOnce('getOnlineUserIds', error)
		return []
	}
}
