// Sends a one-off test push notification to every registered device —
// signed-in users and anonymous (not-signed-in) devices alike.
//
//   bun run notification
//
import { db } from '../db/db'
import { pushTokens } from '../db/schema'
import { pushNotificationService } from '../services/pushNotificationService'

const count = await db.$count(pushTokens)

if (count === 0) {
	console.log('No registered push tokens — nothing to send.')
	process.exit(0)
}

await pushNotificationService.sendBroadcastToAll({
	title: 'Afghan Bazar',
	body: 'This is a test notification 🔔',
	data: { type: 'test' },
})

console.log(`Sent test notification to ${count} device(s).`)
process.exit(0)
