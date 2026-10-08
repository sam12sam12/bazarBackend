import { categoryService } from './categoryService'
import { contentVersionService } from './contentVersionService'
import { provinceService } from './provinceService'

export const metaService = {
	async getMetadata() {
		const [{ categories, attributesByCategory }, provinces] = await Promise.all(
			[categoryService.getTree(), provinceService.getAll()],
		)

		return { categories, attributesByCategory, provinces }
	},

	async getVersion() {
		return contentVersionService.getVersion()
	},

	getAppVersion() {
		const isUnderWorking = false

		const android = {
			version: '1.0.0',
			forceUpdate: false,
		}

		const ios = {
			version: '1.0.0',
			forceUpdate: true,
		}

		return { isUnderWorking, android, ios }
	},
}
