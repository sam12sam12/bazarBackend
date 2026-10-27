import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { stores } from '../src/db/schema'
import type { InsertStore } from '../src/db/validation'
import {
	getLeafCategories,
	getProvinces,
	getUserIds,
	type ProvinceRow,
} from '.'
import {
	afghanStoreDescription,
	afghanStoreName,
	afghanStreetAddress,
} from './afghanData'
import { randomProductImageUrls } from './categoryImages'
import { afghanMobile } from './users'

export function createRandomStore(params: {
	ownerIds: string[]
	leafCategories: {
		id: number
		path: string
		name: { ps: string }
		icon_url: string | null
	}[]
	provinces: ProvinceRow[]
}): InsertStore {
	const owner_id = faker.helpers.arrayElement(params.ownerIds)
	// `path` mirrors whichever category a store belongs to — same rule
	// storeService.create applies on a real create, so the seed needs to
	// copy it from the actually-picked category instead of inventing one.
	const category = faker.helpers.arrayElement(params.leafCategories)
	const province = faker.helpers.arrayElement(params.provinces)
	const provinceId = province.id
	const name = afghanStoreName(category.name.ps)

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
	const [logoUrl, bannerUrl] = randomProductImageUrls(
		category.id,
		category.icon_url,
		2,
	)

	return {
		name,
		owner_id,
		category_id: category.id,
		path: category.path,
		description: afghanStoreDescription(category.name.ps, province.namePs),
		is_active: true,
		// real estate/vehicles don't ship — matches the products side's own
		// delivery_available roll, not every store should offer it.
		delivery_available: faker.datatype.boolean({ probability: 0.7 }),
		address: `${afghanStreetAddress(province.code, province.namePs)}، افغانستان`,
		province_id: provinceId,
		latitude: lat,
		longitude: lon,
		logo_url: logoUrl ?? null,
		banner_url: bannerUrl ?? null,
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
	const provinces = await getProvinces()

	const storesFakerData: InsertStore[] = faker.helpers.multiple(
		() =>
			createRandomStore({
				ownerIds: userIds,
				leafCategories,
				provinces,
			}),
		{
			count,
		},
	)

	await db.insert(stores).values(storesFakerData)
}
