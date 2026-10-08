// In-memory presence registry for chat — "online" means "at least one
// websocket is open for this user right now, on this single process."
// Deliberately not Redis-backed: this backend runs as one instance, so a
// module-scope Map is both correct and free of network round-trips. If a
// second instance is ever added, swap this file's internals for a
// Redis-backed version (see the comment above `registerConnection`) —
// `wsRouter.ts` only ever imports these function names, never touches the
// Map directly, so that swap never touches the caller.
const connectionCounts = new Map<string, number>()

// Returns true only on a user's *first* open connection — a second tab/
// device shouldn't re-announce "online". A Redis-backed version of this
// same function would wrap the `incr` in a try/catch and fail soft (return
// false) if Redis were down; an in-memory Map can't fail, so there's
// nothing to guard here.
export function registerConnection(userId: string): boolean {
	const count = (connectionCounts.get(userId) ?? 0) + 1
	connectionCounts.set(userId, count)
	return count === 1
}

// Returns true only on a user's *last* open connection — i.e. they just
// went offline.
export function unregisterConnection(userId: string): boolean {
	const count = (connectionCounts.get(userId) ?? 1) - 1
	if (count <= 0) {
		connectionCounts.delete(userId)
		return true
	}
	connectionCounts.set(userId, count)
	return false
}

export function getOnlineUserIds(userIds: string[]): string[] {
	return userIds.filter((id) => connectionCounts.has(id))
}
