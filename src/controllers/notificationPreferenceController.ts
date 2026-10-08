import type { Context } from 'hono'
import { notificationPreferenceService } from '../services/notificationPreferenceService'

export const notificationPreferenceController = {
	async get(c: Context) {
		const user = c.get('user')
		const preferences = await notificationPreferenceService.getOrCreate(user.id)
		return c.json({ success: true, data: preferences })
	},

	async update(c: Context) {
		const user = c.get('user')
		const patch = c.get('validated')
		const preferences = await notificationPreferenceService.update(
			user.id,
			patch,
		)
		return c.json({ success: true, data: preferences })
	},
}
