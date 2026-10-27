import { faker } from '@faker-js/faker'

// Curated so the seed data actually reads as Afghan — native Pashto/Dari
// script throughout (names, store names/descriptions, addresses), not
// generic faker.js output transliterated into Latin with ", Afghanistan"
// tacked on. The only place Latin survives is the `latin` slug paired with
// each name, needed to build a valid ASCII email local-part — the display
// `name` column itself is always the script form.

interface NamePart {
	script: string
	latin: string
}

const AFGHAN_MALE_FIRST_NAMES: NamePart[] = [
	{ script: 'احمد', latin: 'ahmad' },
	{ script: 'محمد', latin: 'mohammad' },
	{ script: 'حامد', latin: 'hamid' },
	{ script: 'رشید', latin: 'rashid' },
	{ script: 'فواد', latin: 'fawad' },
	{ script: 'نجیب', latin: 'najib' },
	{ script: 'فرهاد', latin: 'farhad' },
	{ script: 'زلمی', latin: 'zalmai' },
	{ script: 'روح‌الله', latin: 'rohullah' },
	{ script: 'بشیر', latin: 'bashir' },
	{ script: 'نقیب', latin: 'naqib' },
	{ script: 'عبیدالله', latin: 'obaidullah' },
	{ script: 'حکمت', latin: 'hekmat' },
	{ script: 'قدرت‌الله', latin: 'qudratullah' },
	{ script: 'شفیق', latin: 'shafiq' },
	{ script: 'ولید', latin: 'walid' },
	{ script: 'جاوید', latin: 'jawid' },
	{ script: 'میرویس', latin: 'mirwais' },
	{ script: 'خالد', latin: 'khalid' },
	{ script: 'یما', latin: 'yama' },
	{ script: 'سید', latin: 'sayed' },
	{ script: 'عصمت‌الله', latin: 'esmatullah' },
	{ script: 'هارون', latin: 'haroon' },
	{ script: 'نوید', latin: 'naveed' },
	{ script: 'امید', latin: 'omid' },
	{ script: 'ذبیح‌الله', latin: 'zabihullah' },
	{ script: 'احسان‌الله', latin: 'ehsanullah' },
	{ script: 'فهیم', latin: 'fahim' },
	{ script: 'جمشید', latin: 'jamshid' },
	{ script: 'قیس', latin: 'qais' },
]

const AFGHAN_FEMALE_FIRST_NAMES: NamePart[] = [
	{ script: 'فرشته', latin: 'freshta' },
	{ script: 'زهرا', latin: 'zahra' },
	{ script: 'مروا', latin: 'marwa' },
	{ script: 'لیلا', latin: 'laila' },
	{ script: 'سعدیه', latin: 'sadia' },
	{ script: 'شبنم', latin: 'shabnam' },
	{ script: 'وږمه', latin: 'wazhma' },
	{ script: 'بې‌نظیر', latin: 'benazir' },
	{ script: 'رویا', latin: 'roya' },
	{ script: 'پریسا', latin: 'parisa' },
	{ script: 'نادیه', latin: 'nadia' },
	{ script: 'شکریه', latin: 'shukria' },
	{ script: 'ملالۍ', latin: 'malalai' },
	{ script: 'فریده', latin: 'farida' },
	{ script: 'هما', latin: 'homa' },
	{ script: 'سیما', latin: 'sima' },
	{ script: 'زرغونه', latin: 'zarghona' },
	{ script: 'مریم', latin: 'maryam' },
	{ script: 'مرسل', latin: 'mursal' },
	{ script: 'سپوږمۍ', latin: 'spogmai' },
	{ script: 'پلوشه', latin: 'palwasha' },
	{ script: 'هیله', latin: 'hila' },
	{ script: 'توبه', latin: 'tooba' },
	{ script: 'ګلالۍ', latin: 'gulalai' },
	{ script: 'نیلوفر', latin: 'nilofar' },
	{ script: 'ثریا', latin: 'soraya' },
	{ script: 'لطیفه', latin: 'latifa' },
	{ script: 'رحیمه', latin: 'rahima' },
	{ script: 'خاطره', latin: 'khatera' },
	{ script: 'معصومه', latin: 'masooma' },
]

const AFGHAN_LAST_NAMES: NamePart[] = [
	{ script: 'نوري', latin: 'noori' },
	{ script: 'پوپل', latin: 'popal' },
	{ script: 'کریمي', latin: 'karimi' },
	{ script: 'رحیمي', latin: 'rahimi' },
	{ script: 'صدیقي', latin: 'sadiqi' },
	{ script: 'حیدري', latin: 'haidari' },
	{ script: 'عمري', latin: 'omari' },
	{ script: 'وردک', latin: 'wardak' },
	{ script: 'پنجشیري', latin: 'panjshiri' },
	{ script: 'هوتک', latin: 'hotak' },
	{ script: 'بارکزی', latin: 'barakzai' },
	{ script: 'احمدي', latin: 'ahmadi' },
	{ script: 'یوسفزی', latin: 'yousafzai' },
	{ script: 'شیرزی', latin: 'sherzai' },
	{ script: 'مومند', latin: 'mohmand' },
	{ script: 'غلزی', latin: 'ghilzai' },
	{ script: 'فیضي', latin: 'faizi' },
	{ script: 'سلطاني', latin: 'sultani' },
	{ script: 'نظري', latin: 'nazari' },
	{ script: 'قادري', latin: 'qaderi' },
	{ script: 'ستانکزی', latin: 'stanikzai' },
	{ script: 'نیازي', latin: 'niazi' },
	{ script: 'دراني', latin: 'durrani' },
	{ script: 'جلالي', latin: 'jalali' },
	{ script: 'هاشمي', latin: 'hashimi' },
	{ script: 'منگل', latin: 'mangal' },
	{ script: 'کاکړ', latin: 'kakar' },
	{ script: 'اندړ', latin: 'andar' },
	{ script: 'یعقوبي', latin: 'yaqoubi' },
	{ script: 'رسولي', latin: 'rasouli' },
]

function randomNamePart(): NamePart {
	return faker.helpers.arrayElement(
		faker.datatype.boolean()
			? AFGHAN_MALE_FIRST_NAMES
			: AFGHAN_FEMALE_FIRST_NAMES,
	)
}

/** A plausible Afghan full name in native script — e.g. "احمد نوري" — for any
 * display-only text field (notification actor_name, address recipient_name). */
export function afghanFullName(): string {
	const first = randomNamePart()
	const last = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
	return `${first.script} ${last.script}`
}

/** Afghan name pair, script + Latin slug — for users.ts, which needs the
 * script form for the `name` column and the Latin form to build a valid
 * ASCII email local-part. */
export function afghanNameParts(): { first: NamePart; last: NamePart } {
	const first = randomNamePart()
	const last = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
	return { first, last }
}

// Each province's actual provincial capital, in Pashto script — most share
// the province's own name (هرات → هرات, کندهار → کندهار), but a handful
// famously don't (بلخ → مزار شریف, ننګرهار → جلال‌آباد, ...); keyed by the
// same `code` used in seedData/provinces.ts.
export const PROVINCE_CAPITALS_PS: Record<string, string> = {
	kbl: 'کابل',
	knd: 'کندهار',
	hrt: 'هرات',
	blk: 'مزار شریف',
	ngr: 'جلال‌آباد',
	bdn: 'فیض‌آباد',
	bdg: 'قلعه نو',
	bag: 'پل خمري',
	bam: 'بامیان',
	day: 'نیلي',
	fah: 'فراه',
	far: 'میمنه',
	gha: 'غزني',
	gho: 'چاغچران',
	hel: 'لښکرګاه',
	jow: 'شبرغان',
	kap: 'محمودراقي',
	kho: 'خوست',
	kun: 'اسدآباد',
	kdz: 'کندز',
	lag: 'مهترلام',
	log: 'پل علم',
	nim: 'زرنج',
	nur: 'پارون',
	pka: 'ګردیز',
	pki: 'شرنه',
	pan: 'بازارک',
	par: 'چاریکار',
	sam: 'ایبک',
	sar: 'سرپل',
	tak: 'تالقان',
	uru: 'ترینکوټ',
	war: 'میدان شهر',
	zab: 'قلات',
}

// Real, well-known Kabul neighborhoods in Pashto script — Kabul alone gets
// this treatment (rather than every province) since it's realistically
// where the bulk of a classifieds app's seeded addresses would cluster,
// same as real usage.
const KABUL_AREAS = [
	'شهر نو',
	'وزیر اکبر خان',
	'کارته سه',
	'کارته چهار',
	'تایمني',
	'خیرخانه',
	'قلعه فتح‌الله',
	'دشت برچي',
	'خوشحال خان',
	'قلعه شاده',
	'کارته پروان',
	'چهارقلعه',
	'ده افغانان',
	'پل سرخ',
]

const EASTERN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Western digits → Eastern Arabic-Indic digits (۱۲۳...) — matches how
 * numbers actually appear in Pashto/Dari text, including elsewhere in this
 * app (see localMetaData.ts's own placeholder examples, e.g. "مثلاً ۳"). */
function toEasternDigits(n: number): string {
	return String(n)
		.split('')
		.map((d) => EASTERN_DIGITS[Number(d)] ?? d)
		.join('')
}

/** City/town text for an address — Kabul picks a real neighborhood (more
 * realistic than just "کابل" for every single Kabul row); every other
 * province resolves to its actual provincial capital. */
function afghanLocality(provinceCode: string): string {
	if (provinceCode === 'kbl') return faker.helpers.arrayElement(KABUL_AREAS)
	return PROVINCE_CAPITALS_PS[provinceCode] ?? provinceCode
}

/** Full street-level address text in Pashto, e.g. "کور نمبر ۱۴، سړک ۳، شهر
 * نو، کابل" or "کور نمبر ۷، لښکرګاه، هلمند" — `provinceNamePs` is the
 * province's own `name.ps` (already available to every caller from its own
 * province row, no extra lookup needed). `ناحیه`/`کور نمبر`/`سړک` are the
 * real administrative terms Afghan addresses actually use (Kabul's 22
 * districts are officially "ناحیه" — see afghanDistrict below). */
export function afghanStreetAddress(
	provinceCode: string,
	provinceNamePs: string,
): string {
	const house = toEasternDigits(faker.number.int({ min: 1, max: 999 }))
	const locality = afghanLocality(provinceCode)
	if (provinceCode === 'kbl') {
		const street = toEasternDigits(faker.number.int({ min: 1, max: 15 }))
		return `کور نمبر ${house}، سړک ${street}، ${locality}، کابل`
	}
	if (locality === provinceNamePs) return `کور نمبر ${house}، ${locality}`
	return `کور نمبر ${house}، ${locality}، ${provinceNamePs}`
}

/** "ناحیه ۷" — the real official term for Kabul's (and, informally, other
 * cities') numbered administrative districts, replacing the old plain
 * "District N" placeholder. */
export function afghanDistrict(): string {
	return `ناحیه ${toEasternDigits(faker.number.int({ min: 1, max: 22 }))}`
}

const STORE_WORDS = ['آریانا', 'خراسان', 'باختر', 'افغان', 'نور', 'ستاره']
const STORE_SUFFIXES = [
	'سټور',
	'دوکان',
	'مارکیټ',
	'مرکز',
	'ګالري',
	'پلازا',
	'سوپر مارکیټ',
]
const STORE_LOCALITIES = ['کابل', 'هرات', 'کندهار', 'مزار شریف']

/** A store name that reads like a real Afghan shop sign in Pashto — usually
 * an owner surname or an evocative Afghan brand word, plus the category and
 * a business-type suffix (how most urban Afghan shop signage is actually
 * worded — e.g. "افغان موبایلونه سوپر مارکیټ"). `categoryNamePs` is the
 * category's own `name.ps`. */
export function afghanStoreName(categoryNamePs: string): string {
	const pattern = faker.number.int({ min: 0, max: 2 })
	const suffix = faker.helpers.arrayElement(STORE_SUFFIXES)

	if (pattern === 0) {
		const surname = faker.helpers.arrayElement(AFGHAN_LAST_NAMES)
		return `${surname.script} ${categoryNamePs} ${suffix}`
	}
	if (pattern === 1) {
		const word = faker.helpers.arrayElement(STORE_WORDS)
		return `${word} ${categoryNamePs} ${suffix}`
	}
	const locality = faker.helpers.arrayElement(STORE_LOCALITIES)
	return `${locality} ${categoryNamePs} ${suffix}`
}

/** A short Pashto store description anchored to the real category + real
 * province — e.g. "زموږ دوکان په کابل کې د موبایلونو غوره ډولونه وړاندې
 * کوي." — instead of a disconnected English corporate catchphrase. */
export function afghanStoreDescription(
	categoryNamePs: string,
	provinceNamePs: string,
): string {
	return `زموږ دوکان په ${provinceNamePs} کې د ${categoryNamePs} غوره ډولونه وړاندې کوي.`
}
