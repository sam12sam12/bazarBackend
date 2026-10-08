import type { Context } from 'hono'
import { metaService } from '../services/metaService.ts'

export const metaController = {
	async getMetadata(c: Context) {
		const data = await metaService.getMetadata()
		return c.json({ success: true, data })
	},

	async getVersion(c: Context) {
		const version = await metaService.getVersion()
		return c.json({ success: true, data: { version } })
	},

	getAppVersion(c: Context) {
		const data = metaService.getAppVersion()
		return c.json({ success: true, data })
	},
}
