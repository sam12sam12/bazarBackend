import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { users } from '../src/db/schema'
import type { InsertUser } from '../src/db/validation'
import { afghanNameParts } from './afghanData'

// E.164: `+` then 7-15 digits, no leading 0 — see backend CLAUDE.md. `93` is
// Afghanistan's country code, `7` the real leading digit of an Afghan
// mobile number (what used to be the local "07..." prefix minus the 0).
export function afghanMobile() {
	const eightDigits = faker.number.int({ min: 0, max: 99_999_999 })
	return `+937${String(eightDigits).padStart(8, '0')}`
}

function createRandomUser(): InsertUser {
	const { first, last } = afghanNameParts()
	const uniqueSuffix = faker.string.alphanumeric(8)
	// Email needs ASCII, so the Latin slug does the work here — the `name`
	// column itself stays the real Pashto/Dari script form below.
	const email = `${first.latin}.${last.latin}.${uniqueSuffix}@gmail.com`

	return {
		id: faker.string.uuid(),
		name: `${first.script} ${last.script}`,
		email,
		phone: afghanMobile(),
		avatar_url: faker.image.avatar(),
		role: faker.helpers.arrayElement(['admin', 'seller', 'buyer']),
		is_active: faker.datatype.boolean(),
		last_login: faker.date.recent({ days: 30 }),
	}
}

export async function seedUsersFakerData(count = 10) {
	const usersFakerData: InsertUser[] = faker.helpers.multiple(
		createRandomUser,
		{ count },
	)

	await db.insert(users).values(usersFakerData)
}
