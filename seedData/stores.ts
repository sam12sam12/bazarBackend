import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { stores } from '../src/db/schema'
import type { InsertStore } from '../src/db/validation'
import { getCategoryIds, getProvinceIds, getUserIds } from '.'
import { afghanMobile } from './users'

export function createRandomStore(params: {
	ownerIds: string[]
	categoryIds: number[]
	provinceIds: number[]
}): InsertStore {
	const owner_id = faker.helpers.arrayElement(params.ownerIds)
	const categoryId = faker.helpers.arrayElement(params.categoryIds)
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

	// Note: postgres ltree uses dot-separated labels.
	const pathRoot = faker.helpers.arrayElement([
		'electronics',
		'real-estate',
		'clothes',
		'services',
		'automotive',
	])
	const path = faker.datatype.boolean()
		? `${pathRoot}.${faker.helpers.arrayElement(['deals', 'new', 'local', 'top'])}`
		: pathRoot

	const productCount = faker.number.int({ min: 0, max: 200 })

	return {
		name,
		owner_id,
		category_id: categoryId,
		path,
		description: faker.company.catchPhrase(),
		is_active: true,
		address: `${faker.location.streetAddress()}, ${faker.location.city()}, Afghanistan`,
		province_id: provinceId,
		latitude: lat,
		longitude: lon,
		logo_url: faker.image.urlPicsumPhotos({ width: 200, height: 200 }),
		banner_url: faker.image.urlPicsumPhotos({ width: 800, height: 250 }),
		contact_phone: afghanMobile(),
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
	const categoryIds = await getCategoryIds()
	const provinceIds = await getProvinceIds()

	const storesFakerData: InsertStore[] = faker.helpers.multiple(
		() =>
			createRandomStore({
				ownerIds: userIds,
				categoryIds,
				provinceIds,
			}),
		{
			count,
		},
	)

	await db.insert(stores).values(storesFakerData)
}
