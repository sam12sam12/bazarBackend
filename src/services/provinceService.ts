import { sql } from 'drizzle-orm'
import { db } from '../db/db'
import { provinces } from '../db/schema'

export const provinceService = {
	async getAll() {
		const provinceData = await db
			.select({
				id: provinces.id,
				name: provinces.name,
				code: provinces.code,
			})
			.from(provinces)
			.orderBy(sql`${provinces.name}->>'en'`)
		return provinceData
	},
}
