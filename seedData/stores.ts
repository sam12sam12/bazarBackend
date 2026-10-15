import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { stores } from '../src/db/schema'
import type { InsertStore } from '../src/db/validation'
import { getLeafCategories, getProvinceIds, getUserIds } from '.'
import { afghanMobile } from './users'

export function createRandomStore(params: {
	ownerIds: string[]
	leafCategories: { id: number; path: string }[]
	provinceIds: number[]
}): InsertStore {
	const owner_id = faker.helpers.arrayElement(params.ownerIds)
	// `path` mirrors whichever category a store belongs to — same rule
	// storeService.create applies on a real create, so the seed needs to
	// copy it from the actually-picked category instead of inventing one.
	const category = faker.helpers.arrayElement(params.leafCategories)
	const provinceId = faker.helpers.arrayElement(params.provinceIds)
	const name = faker.company.name()

	const lat = faker.number.float({ min: 29.0, max: 38.5, fractionDigits: 7 })
	const lon = faker.number.float({ min: 60.5, max: 74.0, fractionDigits: 7 })

	const approval = faker.helpers.weightedArrayElement([
		{ weight: 70, value: 'approved' as const },
		{ weight: 25, value: 'pending' as const },
		{ weight: 5, value: 'rejected' as const },
	])

	const approvedAt =
		approval === 'approved' ? faker.date.recent({ days: 60 }) : null

	const productCount = faker.number.int({ min: 0, max: 200 })

	return {
		name,
		owner_id,
		category_id: category.id,
		path: category.path,
		description: faker.company.catchPhrase(),
		is_active: true,
		// real estate/vehicles don't ship — matches the products side's own
		// delivery_available roll, not every store should offer it.
		delivery_available: faker.datatype.boolean({ probability: 0.7 }),
		address: `${faker.location.streetAddress()}, ${faker.location.city()}, Afghanistan`,
		province_id: provinceId,
		latitude: lat,
		longitude: lon,
		logo_url: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
		banner_url: faker.image.urlPicsumPhotos({ width: 800, height: 250 }),
		contact_phone: afghanMobile(),
		secondary_phone: faker.datatype.boolean({ probability: 0.3 })
			? afghanMobile()
			: null,
		whatsapp: faker.datatype.boolean({ probability: 0.6 })
			? afghanMobile()
			: null,
		contact_email: faker.internet
			.email({ provider: 'gmail.com' })
			.toLowerCase(),
		approval_status: approval,
		approved_at: approvedAt,
		product_count: productCount,
		featured: faker.datatype.boolean(),
	}
}

export async function generateStoresFakerData(count = 10) {
	const userIds = await getUserIds()
	const leafCategories = await getLeafCategories()
	const provinceIds = await getProvinceIds()

	const storesFakerData: InsertStore[] = faker.helpers.multiple(
		() =>
			createRandomStore({
				ownerIds: userIds,
				leafCategories,
				provinceIds,
			}),
		{
			count,
		},
	)

	await db.insert(stores).values(storesFakerData)
}
