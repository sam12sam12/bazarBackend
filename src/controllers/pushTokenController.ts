import type { Context } from 'hono'
import { pushTokenService } from '../services/pushTokenService'

export const pushTokenController = {
	async register(c: Context) {
		const data = c.get('validated')
		const user = c.get('user')
		await pushTokenService.upsert(user.id, data)
		return c.json({ success: true, message: 'Push token registered' })
	},

	async unregister(c: Context) {
		const user = c.get('user')
		await pushTokenService.remove(user.id)
		return c.json({ success: true, message: 'Push token removed' })
	},

	// No auth required — lets a not-signed-in device still receive
	// broadcast notifications. See pushTokenService.upsert for how this
	// row gets claimed once the same device signs in.
	async registerAnonymous(c: Context) {
		const data = c.get('validated')
		await pushTokenService.upsertAnonymous(data)
		return c.json({ success: true, message: 'Push token registered' })
	},
}
