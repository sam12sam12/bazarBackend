import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/db'
import { addresses } from '../src/db/schema'
import type { InsertAddress } from '../src/db/validation'
import {
	afghanDistrict,
	afghanFullName,
	afghanStreetAddress,
} from './afghanData'
import { getProvinces, getUserIds, type ProvinceRow } from './index'
import { afghanMobile } from './users'

export function createRandomAddress(params: {
	userId: string
	provinces: ProvinceRow[]
	isDefault: boolean
}): InsertAddress {
	const province = faker.helpers.arrayElement(params.provinces)
	const district = afghanDistrict()
	const address_line = afghanStreetAddress(province.code, province.namePs)
	const lat = faker.number
		.float({ min: 29.0, max: 38.5, fractionDigits: 6 })
		.toString()
	const lon = faker.number
		.float({ min: 60.5, max: 74.5, fractionDigits: 6 })
		.toString()

	return {
		user_id: params.userId,
		province_id: province.id,
		district,
		address_line,
		recipient_name: afghanFullName(),
		phone: afghanMobile(),
		type: faker.helpers.arrayElement(['home', 'work', 'other']),
		is_default: params.isDefault,
		latitude: lat,
		longitude: lon,
	}
}

export async function generateAddressesFakerData(count?: number) {
	const userIds = await getUserIds()
	const provinces = await getProvinces()

	if (userIds.length === 0) {
		return
	}

	// Query users who already have a default address in the database
	const existingDefaultAddresses = await db
		.select({ user_id: addresses.user_id })
		.from(addresses)
		.where(eq(addresses.is_default, true))

	const usersWithDefaultSet = new Set(
		existingDefaultAddresses.map((a) => a.user_id),
	)

	const addressesFakerData: InsertAddress[] = []

	if (count !== undefined) {
		const currentGenDefaultSet = new Set<string>()

		for (let i = 0; i < count; i++) {
			const userId = faker.helpers.arrayElement(userIds)
			const hasDefaultAlready =
				usersWithDefaultSet.has(userId) || currentGenDefaultSet.has(userId)
			const isDefault = !hasDefaultAlready

			if (isDefault) {
				currentGenDefaultSet.add(userId)
			}

			addressesFakerData.push(
				createRandomAddress({
					userId,
					provinces,
					isDefault,
				}),
			)
		}
	} else {
		for (const userId of userIds) {
			const addressCount = faker.number.int({ min: 1, max: 3 })
			const hasDefaultAlready = usersWithDefaultSet.has(userId)

			for (let i = 0; i < addressCount; i++) {
				// Set the first generated address as default only if the user doesn't already have one in the DB
				const isDefault = !hasDefaultAlready && i === 0

				addressesFakerData.push(
					createRandomAddress({
						userId,
						provinces,
						isDefault,
					}),
				)
			}
		}
	}

	await db.insert(addresses).values(addressesFakerData)
}
