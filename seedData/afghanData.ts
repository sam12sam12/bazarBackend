import { faker } from '@faker-js/faker'

// Curated so the seed data actually reads as Afghan instead of generic
// faker.js output (Western names/cities/company names) with ", Afghanistan"
// tacked onto the end. Transliterations follow common English/Dari/Pashto
// usage (news wires, diaspora naming conventions), not a single strict
// romanization scheme — same inconsistency real Afghan name spellings have.

const AFGHAN_MALE_FIRST_NAMES = [
	'Ahmad',
	'Mohammad',
	'Hamid',
	'Rashid',
	'Fawad',
	'Najib',
	'Farhad',
	'Zalmai',
	'Rohullah',
	'Bashir',
	'Naqib',
	'Obaidullah',
	'Hekmat',
	'Qudratullah',
	'Shafiq',
	'Walid',
	'Jawid',
	'Mirwais',
	'Khalid',
	'Yama',
	'Sayed',
	'Esmatullah',
	'Haroon',
	'Naveed',
	'Omid',
	'Zabihullah',
	'Ehsanullah',
	'Fahim',
	'Jamshid',
	'Qais',
]

const AFGHAN_FEMALE_FIRST_NAMES = [
	'Freshta',
	'Zahra',
	'Marwa',
	'Laila',
	'Sadia',
	'Shabnam',
	'Wazhma',
	'Benazir',
	'Roya',
	'Parisa',
	'Nadia',
	'Shukria',
	'Malalai',
	'Farida',
	'Homa',
	'Sima',
	'Zarghona',
	'Maryam',
	'Mursal',
	'Spogmai',
	'Palwasha',
	'Hila',
	'Tooba',
	'Gulalai',
	'Nilofar',
	'Soraya',
	'Latifa',
	'Rahima',
	'Khatera',
	'Masooma',
]

const AFGHAN_LAST_NAMES = [
	'Noori',
	'Popal',
	'Karimi',
	'Rahimi',
	'Sadiqi',
	'Haidari',
	'Omari',
	'Wardak',
	'Panjshiri',
	'Hotak',
	'Barakzai',
	'Ahmadi',
	'Yousafzai',
	'Sherzai',
	'Mohmand',
	'Ghilzai',
	'Faizi',
	'Sultani',
	'Nazari',
	'Qaderi',
	'Stanikzai',
	'Niazi',
	'Durrani',
	'Jalali',
	'Hashimi',
	'Mangal',
	'Kakar',
	'Andar',
	'Yaqoubi',
	'Rasouli',
]

/** A plausible Afghan full name — independent 50/50 gender roll on the
 * first name, paired with a random surname (Afghan surnames aren't
 * gendered the way the given names are). */
export function afghanFullName(): string {
	const first = faker.helpers.arrayElement(
		faker.datatype.boolean()
			? AFGHAN_MALE_FIRST_NAMES
			: AFGHAN_FEMALE_FIRST_NAMES,
	)
	const last = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
	return `${first} ${last}`
}

/** Afghan name pair, split — for callers (users.ts) that need the parts
 * separately, e.g. to build an email local-part. */
export function afghanNameParts(): { first: string; last: string } {
	const first = faker.helpers.arrayElement(
		faker.datatype.boolean()
			? AFGHAN_MALE_FIRST_NAMES
			: AFGHAN_FEMALE_FIRST_NAMES,
	)
	const last = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
	return { first, last }
}

// Each province's actual provincial capital — most share the province's own
// name (Herat → Herat, Kandahar → Kandahar), but a handful famously don't
// (Balkh → Mazar-e-Sharif, Nangarhar → Jalalabad, ...); keyed by the same
// `code` used in seedData/provinces.ts.
export const PROVINCE_CAPITALS: Record<string, string> = {
	kbl: 'Kabul',
	knd: 'Kandahar',
	hrt: 'Herat',
	blk: 'Mazar-e-Sharif',
	ngr: 'Jalalabad',
	bdn: 'Faizabad',
	bdg: 'Qala-e-Naw',
	bag: 'Pul-e-Khumri',
	bam: 'Bamyan',
	day: 'Nili',
	fah: 'Farah',
	far: 'Maimana',
	gha: 'Ghazni',
	gho: 'Chaghcharan',
	hel: 'Lashkar Gah',
	jow: 'Sheberghan',
	kap: 'Mahmud-i-Raqi',
	kho: 'Khost',
	kun: 'Asadabad',
	kdz: 'Kunduz',
	lag: 'Mihtarlam',
	log: 'Pul-e-Alam',
	nim: 'Zaranj',
	nur: 'Parun',
	pka: 'Gardez',
	pki: 'Sharana',
	pan: 'Bazarak',
	par: 'Charikar',
	sam: 'Aybak',
	sar: 'Sar-e Pol',
	tak: 'Taloqan',
	uru: 'Tarinkot',
	war: 'Maidan Shar',
	zab: 'Qalat',
}

// Real, well-known Kabul neighborhoods — Kabul alone gets this treatment
// (rather than every province) since it's realistically where the bulk of
// a classifieds app's seeded addresses would cluster, same as real usage.
const KABUL_AREAS = [
	'Shahr-e-Naw',
	'Wazir Akbar Khan',
	'Karte Se',
	'Karte Char',
	'Taimani',
	'Khair Khana',
	'Qala-e-Fatehullah',
	'Dasht-e-Barchi',
	'Khoshal Khan',
	'Shar-e-Naw',
	'Qala-e-Shada',
	'Kart-e-Parwan',
	'Chahar Qala',
	'Deh Afghanan',
	'Pul-e-Sorkh',
]

/** City/town text for an address — Kabul picks a real neighborhood (more
 * realistic than just "Kabul" for every single Kabul row); every other
 * province resolves to its actual provincial capital. */
function afghanLocality(provinceCode: string): string {
	if (provinceCode === 'kbl') return faker.helpers.arrayElement(KABUL_AREAS)
	return PROVINCE_CAPITALS[provinceCode] ?? provinceCode
}

/** Full street-level address text, e.g. "House #14, Street 3, Shahr-e-Naw,
 * Kabul" or "House #7, Lashkar Gah, Helmand" — `provinceName` is the
 * province's own `name.en` (already available to every caller from its own
 * province row, no extra lookup needed). */
export function afghanStreetAddress(
	provinceCode: string,
	provinceName: string,
): string {
	const house = faker.number.int({ min: 1, max: 999 })
	const locality = afghanLocality(provinceCode)
	if (provinceCode === 'kbl') {
		const street = faker.number.int({ min: 1, max: 15 })
		return `House #${house}, Street ${street}, ${locality}, Kabul`
	}
	if (locality === provinceName) return `House #${house}, ${locality}`
	return `House #${house}, ${locality}, ${provinceName}`
}

const STORE_WORDS = [
	'Ariana',
	'Khorasan',
	'Bakhtar',
	'Baran',
	'Sapphire',
	'Noor',
]
const STORE_SUFFIXES = [
	'Store',
	'Shop',
	'Mart',
	'Center',
	'House',
	'Gallery',
	'Traders',
]

/** A store name that reads like a real Afghan shop sign — usually an owner
 * surname or an evocative Afghan brand word, plus the category and a
 * business-type suffix (how most urban Afghan shop signage is actually
 * worded — English/Dari mixed, category-first-or-last varies). */
export function afghanStoreName(categoryNameEn: string): string {
	const pattern = faker.number.int({ min: 0, max: 2 })
	const suffix = faker.helpers.arrayElement(STORE_SUFFIXES)

	if (pattern === 0) {
		const surname = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
		return `${surname} ${categoryNameEn} ${suffix}`
	}
	if (pattern === 1) {
		const word = faker.helpers.arrayElement(STORE_WORDS)
		return `${word} ${categoryNameEn} ${suffix}`
	}
	const locality = faker.helpers.arrayElement([
		'Kabul',
		'Herat',
		'Kandahar',
		'Mazar',
	])
	return `${locality} ${categoryNameEn} ${suffix}`
}
