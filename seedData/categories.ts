import type {
	InsertCategory,
	InsertCategoryAttribute,
} from '../src/db/validation'

// Ids 1–14 are untouched — already live, already referenced by seeded
// products/stores. Everything from 15 on is a pure addition.
export const categorySeedData: InsertCategory[] = [
	{
		id: 1,
		name: { en: 'Electronics', ps: 'الکترونیک', fa: 'الکترونیک' },
		parent_id: null,
		path: 'electronics',
		depth: 0,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 2,
		name: { en: 'Real Estate', ps: 'ملکیت', fa: 'املاک' },
		parent_id: null,
		path: 'real-estate',
		depth: 0,
		sort_order: 2,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		// Immovable property — never shippable/deliverable, unlike every other
		// department.
		delivery: false,
		is_popular: false,
	},
	{
		id: 3,
		name: { en: 'Clothes', ps: 'کالي', fa: 'لباس' },
		parent_id: null,
		path: 'clothes',
		depth: 0,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 4,
		name: { en: 'Vehicles', ps: 'موټرونه', fa: 'وسایل نقلیه' },
		parent_id: null,
		path: 'vehicles',
		depth: 0,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 5,
		name: { en: 'Furniture', ps: 'فرنیچر', fa: 'مبلمان' },
		parent_id: null,
		path: 'furniture',
		depth: 0,
		sort_order: 5,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		// Whole department popular — "furniture" is browsed as a dept, not via
		// one specific subcategory (see plan's Popular Categories pick list).
		is_popular: true,
	},
	{
		id: 6,
		name: { en: 'Home Appliances', ps: 'کورنۍ اسباب', fa: 'لوازم خانگی' },
		parent_id: null,
		path: 'home-appliances',
		depth: 0,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 7,
		name: { en: 'Beauty & Health', ps: 'ښکلا او روغتیا', fa: 'زیبایی و سلامت' },
		parent_id: null,
		path: 'beauty-health',
		depth: 0,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 8,
		name: { en: 'Sports & Outdoors', ps: 'سپورت', fa: 'ورزش و فضای باز' },
		parent_id: null,
		path: 'sports-outdoors',
		depth: 0,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 9,
		name: {
			en: 'Books & Stationery',
			ps: 'کتابونه',
			fa: 'کتاب و لوازم‌التحریر',
		},
		parent_id: null,
		path: 'books-stationery',
		depth: 0,
		sort_order: 9,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 10,
		name: { en: 'Toys & Kids', ps: 'د ماشومانو توکي', fa: 'اسباب‌بازی و کودک' },
		parent_id: null,
		path: 'toys-kids',
		depth: 0,
		sort_order: 10,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 11,
		name: {
			en: 'Watches & Jewelry',
			ps: 'ساعتونه او زیورات',
			fa: 'ساعت و جواهرات',
		},
		parent_id: null,
		path: 'watches-jewelry',
		depth: 0,
		sort_order: 11,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 12,
		name: {
			en: 'Art & Crafts',
			ps: 'هنر او صنایع لاسي',
			fa: 'هنر و صنایع دستی',
		},
		parent_id: null,
		path: 'art-crafts',
		depth: 0,
		sort_order: 12,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 13,
		name: { en: 'Mobiles', ps: 'موبایلونه', fa: 'موبایل‌ها' },
		parent_id: 1,
		path: 'electronics.mobiles',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 14,
		name: { en: 'Laptops', ps: 'لپ ټاپونه', fa: 'لپ‌تاپ‌ها' },
		parent_id: 1,
		path: 'electronics.laptops',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800',
		delivery: true,
		is_popular: true,
	},

	// ──────────── Electronics (parent 1) ────────────
	// Every leaf below is one standalone product type — no more merged
	// "X & Y" names (TVs & Home Theater, Cameras & Drones, ...); each half
	// of a former merge is its own category now.
	{
		id: 15,
		name: { en: 'Tablets', ps: 'ټابلیټونه', fa: 'تبلت‌ها' },
		parent_id: 1,
		path: 'electronics.tablets',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 16,
		name: { en: 'Televisions', ps: 'ټلویزیونونه', fa: 'تلویزیون‌ها' },
		parent_id: 1,
		path: 'electronics.televisions',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 102,
		name: {
			en: 'Home Theater Systems',
			ps: 'د کور تیاتر سیسټمونه',
			fa: 'سیستم‌های سینمای خانگی',
		},
		parent_id: 1,
		path: 'electronics.home-theater-systems',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 17,
		name: { en: 'Cameras', ps: 'کمرې', fa: 'دوربین‌ها' },
		parent_id: 1,
		path: 'electronics.cameras',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 103,
		name: { en: 'Drones', ps: 'ډرونونه', fa: 'پهپادها' },
		parent_id: 1,
		path: 'electronics.drones',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 18,
		name: { en: 'Headphones', ps: 'هیدفونونه', fa: 'هدفون‌ها' },
		parent_id: 1,
		path: 'electronics.headphones',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 104,
		name: { en: 'Speakers', ps: 'سپیکرونه', fa: 'اسپیکرها' },
		parent_id: 1,
		path: 'electronics.speakers',
		depth: 1,
		sort_order: 9,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 19,
		name: { en: 'Smart Watches', ps: 'سمارټ ساعتونه', fa: 'ساعت‌های هوشمند' },
		parent_id: 1,
		path: 'electronics.smart-watches',
		depth: 1,
		sort_order: 10,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 105,
		name: { en: 'Fitness Bands', ps: 'د فټنس بنډونه', fa: 'بندهای تناسب اندام' },
		parent_id: 1,
		path: 'electronics.fitness-bands',
		depth: 1,
		sort_order: 11,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 20,
		name: { en: 'Gaming Consoles', ps: 'د لوبو کنسولونه', fa: 'کنسول‌های بازی' },
		parent_id: 1,
		path: 'electronics.gaming-consoles',
		depth: 1,
		sort_order: 12,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 106,
		name: {
			en: 'Gaming Accessories',
			ps: 'د لوبو ملحقات',
			fa: 'لوازم بازی',
		},
		parent_id: 1,
		path: 'electronics.gaming-accessories',
		depth: 1,
		sort_order: 13,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 21,
		name: {
			en: 'Computer Accessories',
			ps: 'د کمپیوټر ملحقات',
			fa: 'لوازم کامپیوتر',
		},
		parent_id: 1,
		path: 'electronics.computer-accessories',
		depth: 1,
		sort_order: 14,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 22,
		name: { en: 'Networking', ps: 'شبکه سازي', fa: 'شبکه' },
		parent_id: 1,
		path: 'electronics.networking',
		depth: 1,
		sort_order: 15,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 23,
		name: { en: 'Printers', ps: 'پرنټرونه', fa: 'پرینترها' },
		parent_id: 1,
		path: 'electronics.printers',
		depth: 1,
		sort_order: 16,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 107,
		name: { en: 'Scanners', ps: 'سکینرونه', fa: 'اسکنرها' },
		parent_id: 1,
		path: 'electronics.scanners',
		depth: 1,
		sort_order: 17,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 24,
		name: { en: 'Power Banks', ps: 'پاور بانکونه', fa: 'پاوربانک‌ها' },
		parent_id: 1,
		path: 'electronics.power-banks',
		depth: 1,
		sort_order: 18,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 108,
		name: { en: 'Chargers', ps: 'چارجرونه', fa: 'شارژرها' },
		parent_id: 1,
		path: 'electronics.chargers',
		depth: 1,
		sort_order: 19,
		icon_url:
			'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Real Estate (parent 2) ────────────
	// Property TYPE only — "for sale" vs "for rent" vs "mortgage" is the
	// `purpose` category_attribute below, not a separate category per type
	// (ids 27/28, the old "...for Rent" leaves, were merged into these).
	{
		id: 25,
		name: { en: 'House', ps: 'کور', fa: 'خانه' },
		parent_id: 2,
		path: 'real-estate.house',
		depth: 1,
		sort_order: 1,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: true,
	},
	{
		id: 26,
		name: { en: 'Apartment', ps: 'اپارتمان', fa: 'آپارتمان' },
		parent_id: 2,
		path: 'real-estate.apartment',
		depth: 1,
		sort_order: 2,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: true,
	},
	{
		id: 29,
		name: { en: 'Land & Plots', ps: 'ځمکه', fa: 'زمین' },
		parent_id: 2,
		path: 'real-estate.land-plots',
		depth: 1,
		sort_order: 3,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 30,
		name: {
			en: 'Commercial Property',
			ps: 'سوداگریزه ملکیت',
			fa: 'ملک تجاری',
		},
		parent_id: 2,
		path: 'real-estate.commercial-property',
		depth: 1,
		sort_order: 4,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 31,
		name: { en: 'Shops', ps: 'دوکانونه', fa: 'دکان‌ها' },
		parent_id: 2,
		path: 'real-estate.shops',
		depth: 1,
		sort_order: 5,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 109,
		name: { en: 'Offices', ps: 'دفترونه', fa: 'دفترها' },
		parent_id: 2,
		path: 'real-estate.offices',
		depth: 1,
		sort_order: 6,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 32,
		name: { en: 'Guest Houses', ps: 'مېلمستون', fa: 'مهمان‌خانه' },
		parent_id: 2,
		path: 'real-estate.guest-houses',
		depth: 1,
		sort_order: 7,
		icon_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
		delivery: false,
		is_popular: false,
	},

	// ──────────── Clothes (parent 3) ────────────
	{
		id: 33,
		name: { en: "Men's Clothing", ps: 'د نارینه کالي', fa: 'لباس مردانه' },
		parent_id: 3,
		path: 'clothes.mens-clothing',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 34,
		name: { en: "Women's Clothing", ps: 'د ښځو کالي', fa: 'لباس زنانه' },
		parent_id: 3,
		path: 'clothes.womens-clothing',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 35,
		name: { en: "Kids' Clothing", ps: 'د ماشومانو کالي', fa: 'لباس بچه‌گانه' },
		parent_id: 3,
		path: 'clothes.kids-clothing',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 36,
		name: {
			en: 'Traditional Afghan Wear',
			ps: 'افغاني دودیز کالي',
			fa: 'لباس سنتی افغانی',
		},
		parent_id: 3,
		path: 'clothes.traditional-afghan-wear',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 37,
		name: { en: 'Shoes', ps: 'بوټان', fa: 'کفش' },
		parent_id: 3,
		path: 'clothes.shoes',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 38,
		name: { en: 'Bags', ps: 'بګونه', fa: 'کیف' },
		parent_id: 3,
		path: 'clothes.bags',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 110,
		name: { en: 'Wallets', ps: 'پاکټونه', fa: 'کیف پول' },
		parent_id: 3,
		path: 'clothes.wallets',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 39,
		name: { en: 'Sunglasses', ps: 'د لمر عینکي', fa: 'عینک آفتابی' },
		parent_id: 3,
		path: 'clothes.sunglasses',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 111,
		name: { en: 'Eyeglasses', ps: 'د لید عینکي', fa: 'عینک طبی' },
		parent_id: 3,
		path: 'clothes.eyeglasses',
		depth: 1,
		sort_order: 9,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 40,
		name: { en: 'Belts', ps: 'پټۍ', fa: 'کمربند' },
		parent_id: 3,
		path: 'clothes.belts',
		depth: 1,
		sort_order: 10,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 112,
		name: { en: 'Fashion Accessories', ps: 'فیشني تزئینات', fa: 'اکسسوری فشن' },
		parent_id: 3,
		path: 'clothes.fashion-accessories',
		depth: 1,
		sort_order: 11,
		icon_url:
			'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Vehicles (parent 4) ────────────
	{
		id: 41,
		name: { en: 'Cars', ps: 'موټرونه', fa: 'موترها' },
		parent_id: 4,
		path: 'vehicles.cars',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: true,
	},
	{
		id: 42,
		name: { en: 'Motorcycles', ps: 'موټرسایکلونه', fa: 'موتورسیکلت‌ها' },
		parent_id: 4,
		path: 'vehicles.motorcycles',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 113,
		name: { en: 'Scooters', ps: 'سکوټرونه', fa: 'اسکوترها' },
		parent_id: 4,
		path: 'vehicles.scooters',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 43,
		name: { en: 'Auto Parts', ps: 'د موټر پرزې', fa: 'قطعات موتر' },
		parent_id: 4,
		path: 'vehicles.auto-parts',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 114,
		name: { en: 'Auto Accessories', ps: 'د موټر ملحقات', fa: 'لوازم جانبی موتر' },
		parent_id: 4,
		path: 'vehicles.auto-accessories',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 44,
		name: { en: 'Tyres', ps: 'ټایرونه', fa: 'تایرها' },
		parent_id: 4,
		path: 'vehicles.tyres',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 115,
		name: { en: 'Rims', ps: 'ریمونه', fa: 'رینگ‌ها' },
		parent_id: 4,
		path: 'vehicles.rims',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 45,
		name: { en: 'Trucks', ps: 'درانه موټرونه', fa: 'کامیون‌ها' },
		parent_id: 4,
		path: 'vehicles.trucks',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 116,
		name: { en: 'Heavy Machinery', ps: 'درانه مکینې', fa: 'ماشین‌آلات سنگین' },
		parent_id: 4,
		path: 'vehicles.heavy-machinery',
		depth: 1,
		sort_order: 9,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 46,
		name: { en: 'Buses', ps: 'بسونه', fa: 'بس‌ها' },
		parent_id: 4,
		path: 'vehicles.buses',
		depth: 1,
		sort_order: 10,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 117,
		name: { en: 'Vans', ps: 'وانونه', fa: 'ون‌ها' },
		parent_id: 4,
		path: 'vehicles.vans',
		depth: 1,
		sort_order: 11,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: false,
		is_popular: false,
	},
	{
		id: 47,
		name: { en: 'Bicycles', ps: 'بایسکلونه', fa: 'دوچرخه‌ها' },
		parent_id: 4,
		path: 'vehicles.bicycles',
		depth: 1,
		sort_order: 12,
		icon_url:
			'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Furniture (parent 5) ────────────
	{
		id: 48,
		name: {
			en: 'Living Room Furniture',
			ps: 'د ناستې خونې فرنیچر',
			fa: 'مبلمان اتاق نشیمن',
		},
		parent_id: 5,
		path: 'furniture.living-room',
		depth: 1,
		sort_order: 1,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 49,
		name: {
			en: 'Bedroom Furniture',
			ps: 'د خوب خونې فرنیچر',
			fa: 'مبلمان اتاق خواب',
		},
		parent_id: 5,
		path: 'furniture.bedroom',
		depth: 1,
		sort_order: 2,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 50,
		name: {
			en: 'Office Furniture',
			ps: 'د دفتر فرنیچر',
			fa: 'مبلمان دفتر',
		},
		parent_id: 5,
		path: 'furniture.office',
		depth: 1,
		sort_order: 3,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 51,
		name: {
			en: 'Dining Furniture',
			ps: 'د ډوډۍ خونې فرنیچر',
			fa: 'مبلمان اتاق غذاخوری',
		},
		parent_id: 5,
		path: 'furniture.dining',
		depth: 1,
		sort_order: 4,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 52,
		name: {
			en: 'Outdoor Furniture',
			ps: 'د بیرون فرنیچر',
			fa: 'مبلمان فضای باز',
		},
		parent_id: 5,
		path: 'furniture.outdoor',
		depth: 1,
		sort_order: 5,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 53,
		name: {
			en: 'Storage & Organization',
			ps: 'د ساتنې لوازم',
			fa: 'لوازم نگهداری',
		},
		parent_id: 5,
		path: 'furniture.storage-organization',
		depth: 1,
		sort_order: 6,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 54,
		name: { en: 'Mattresses', ps: 'توشکونه', fa: 'تشک‌ها' },
		parent_id: 5,
		path: 'furniture.mattresses',
		depth: 1,
		sort_order: 7,
		icon_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Home Appliances (parent 6) ────────────
	{
		id: 55,
		name: { en: 'Refrigerators', ps: 'یخچالونه', fa: 'یخچال‌ها' },
		parent_id: 6,
		path: 'home-appliances.refrigerators',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 118,
		name: { en: 'Freezers', ps: 'فریزرونه', fa: 'فریزرها' },
		parent_id: 6,
		path: 'home-appliances.freezers',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 56,
		name: {
			en: 'Washing Machines',
			ps: 'د کالي مینځلو ماشینونه',
			fa: 'ماشین لباسشویی',
		},
		parent_id: 6,
		path: 'home-appliances.washing-machines',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 57,
		name: { en: 'Air Conditioners', ps: 'ایرکنډیشنونه', fa: 'ایرکاندیشن‌ها' },
		parent_id: 6,
		path: 'home-appliances.air-conditioners',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 119,
		name: { en: 'Air Coolers', ps: 'ایر کولرونه', fa: 'کولرهای آبی' },
		parent_id: 6,
		path: 'home-appliances.air-coolers',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 58,
		name: { en: 'Heaters', ps: 'ګرم کوونکي', fa: 'بخاری‌ها' },
		parent_id: 6,
		path: 'home-appliances.heaters',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 120,
		name: { en: 'Geysers', ps: 'ګیزرونه', fa: 'آبگرم‌کن‌ها' },
		parent_id: 6,
		path: 'home-appliances.geysers',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 59,
		name: { en: 'Microwaves', ps: 'مایکروویفونه', fa: 'مایکروویوها' },
		parent_id: 6,
		path: 'home-appliances.microwaves',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 121,
		name: { en: 'Ovens', ps: 'تنورونه', fa: 'اوون‌ها' },
		parent_id: 6,
		path: 'home-appliances.ovens',
		depth: 1,
		sort_order: 9,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 60,
		name: {
			en: 'Small Kitchen Appliances',
			ps: 'د کوچنۍ پخلنځي اسباب',
			fa: 'لوازم کوچک آشپزخانه',
		},
		parent_id: 6,
		path: 'home-appliances.small-kitchen-appliances',
		depth: 1,
		sort_order: 10,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 61,
		name: { en: 'Generators', ps: 'جنراتورونه', fa: 'ژنراتورها' },
		parent_id: 6,
		path: 'home-appliances.generators',
		depth: 1,
		sort_order: 11,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 122,
		name: { en: 'Solar Equipment', ps: 'د لمر وړانګو توکي', fa: 'تجهیزات سولار' },
		parent_id: 6,
		path: 'home-appliances.solar-equipment',
		depth: 1,
		sort_order: 12,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 62,
		name: { en: 'Fans', ps: 'پنکې', fa: 'پنکه‌ها' },
		parent_id: 6,
		path: 'home-appliances.fans',
		depth: 1,
		sort_order: 13,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 63,
		name: { en: 'Water Dispensers', ps: 'د اوبو ماشینونه', fa: 'دستگاه آب سردکن' },
		parent_id: 6,
		path: 'home-appliances.water-dispensers',
		depth: 1,
		sort_order: 14,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 123,
		name: { en: 'Water Purifiers', ps: 'د اوبو پاکوونکي', fa: 'دستگاه تصفیه آب' },
		parent_id: 6,
		path: 'home-appliances.water-purifiers',
		depth: 1,
		sort_order: 15,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 64,
		name: {
			en: 'Vacuum Cleaners',
			ps: 'واکیوم کلینرونه',
			fa: 'جاروبرقی',
		},
		parent_id: 6,
		path: 'home-appliances.vacuum-cleaners',
		depth: 1,
		sort_order: 16,
		icon_url:
			'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Beauty & Health (parent 7) ────────────
	{
		id: 65,
		name: { en: 'Skincare', ps: 'د پوستکي پاملرنه', fa: 'مراقبت از پوست' },
		parent_id: 7,
		path: 'beauty-health.skincare',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 66,
		name: { en: 'Makeup', ps: 'میک اپ', fa: 'آرایش' },
		parent_id: 7,
		path: 'beauty-health.makeup',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 67,
		name: { en: 'Hair Care Products', ps: 'د ویښتو پاملرنه', fa: 'مراقبت از مو' },
		parent_id: 7,
		path: 'beauty-health.hair-care-products',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 124,
		name: { en: 'Hair Styling Tools', ps: 'د ویښتو ډیزاین وسایل', fa: 'ابزار آرایش مو' },
		parent_id: 7,
		path: 'beauty-health.hair-styling-tools',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 68,
		name: { en: 'Perfumes', ps: 'عطرونه', fa: 'عطرها' },
		parent_id: 7,
		path: 'beauty-health.perfumes',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 69,
		name: { en: 'Personal Care', ps: 'شخصي پاملرنه', fa: 'مراقبت شخصی' },
		parent_id: 7,
		path: 'beauty-health.personal-care',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 70,
		name: {
			en: 'Health & Wellness Devices',
			ps: 'د روغتیا وسایل',
			fa: 'دستگاه‌های سلامتی',
		},
		parent_id: 7,
		path: 'beauty-health.health-wellness-devices',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 71,
		name: {
			en: "Men's Grooming",
			ps: 'د نارینه وو پاملرنه',
			fa: 'مراقبت مردانه',
		},
		parent_id: 7,
		path: 'beauty-health.mens-grooming',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Sports & Outdoors (parent 8) ────────────
	{
		id: 72,
		name: { en: 'Fitness Equipment', ps: 'د بدني روغتیا وسایل', fa: 'لوازم ورزشی' },
		parent_id: 8,
		path: 'sports-outdoors.fitness-equipment',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 73,
		name: { en: 'Cycling', ps: 'بایسکل سواري', fa: 'دوچرخه‌سواری' },
		parent_id: 8,
		path: 'sports-outdoors.cycling',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 74,
		name: { en: 'Cricket Gear', ps: 'د کرکټ سامان', fa: 'لوازم کریکت' },
		parent_id: 8,
		path: 'sports-outdoors.cricket-gear',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 75,
		name: { en: 'Football Gear', ps: 'د فوټبال سامان', fa: 'لوازم فوتبال' },
		parent_id: 8,
		path: 'sports-outdoors.football-gear',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 76,
		name: { en: 'Camping & Hiking', ps: 'کمپینګ', fa: 'کمپینگ' },
		parent_id: 8,
		path: 'sports-outdoors.camping-hiking',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 77,
		name: { en: 'Outdoor Games', ps: 'بیرون ته لوبې', fa: 'بازی‌های فضای باز' },
		parent_id: 8,
		path: 'sports-outdoors.outdoor-games',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 78,
		name: { en: 'Sportswear', ps: 'د سپورت کالي', fa: 'لباس ورزشی' },
		parent_id: 8,
		path: 'sports-outdoors.sportswear',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Books & Stationery (parent 9) ────────────
	{
		id: 79,
		name: { en: 'Academic Books', ps: 'درسي کتابونه', fa: 'کتاب‌های درسی' },
		parent_id: 9,
		path: 'books-stationery.academic-books',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 80,
		name: { en: 'Islamic Books', ps: 'اسلامي کتابونه', fa: 'کتاب‌های دینی' },
		parent_id: 9,
		path: 'books-stationery.islamic-books',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 81,
		name: { en: 'Novels', ps: 'ناولونه', fa: 'رمان‌ها' },
		parent_id: 9,
		path: 'books-stationery.novels',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 82,
		name: {
			en: 'Office & School Stationery',
			ps: 'د دفتر توکي',
			fa: 'لوازم‌التحریر',
		},
		parent_id: 9,
		path: 'books-stationery.office-school-stationery',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 83,
		name: { en: 'Notebooks', ps: 'کتابچې', fa: 'دفترچه‌ها' },
		parent_id: 9,
		path: 'books-stationery.notebooks',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 125,
		name: { en: 'Diaries', ps: 'ورځپاڼې', fa: 'یادداشت‌ها' },
		parent_id: 9,
		path: 'books-stationery.diaries',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 84,
		name: { en: 'Art Supplies', ps: 'د هنر توکي', fa: 'لوازم هنری' },
		parent_id: 9,
		path: 'books-stationery.art-supplies',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Toys & Kids (parent 10) ────────────
	{
		id: 85,
		name: { en: 'Baby Gear', ps: 'د ماشوم سامان', fa: 'لوازم نوزاد' },
		parent_id: 10,
		path: 'toys-kids.baby-gear',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 86,
		name: { en: 'Toys', ps: 'لوبغالي', fa: 'اسباب‌بازی' },
		parent_id: 10,
		path: 'toys-kids.toys',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 87,
		name: {
			en: 'Educational Toys',
			ps: 'تعلیمي لوبغالي',
			fa: 'اسباب‌بازی آموزشی',
		},
		parent_id: 10,
		path: 'toys-kids.educational-toys',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 88,
		name: { en: "Kids' Bicycles", ps: 'د ماشومانو بایسکلونه', fa: 'دوچرخه کودکان' },
		parent_id: 10,
		path: 'toys-kids.kids-bicycles',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 126,
		name: { en: 'Ride-on Toys', ps: 'سواري لوبغالي', fa: 'اسباب‌بازی سوارشدنی' },
		parent_id: 10,
		path: 'toys-kids.ride-on-toys',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 89,
		name: {
			en: 'Baby Feeding & Nursing',
			ps: 'د ماشوم تغذیه',
			fa: 'تغذیه نوزاد',
		},
		parent_id: 10,
		path: 'toys-kids.baby-feeding-nursing',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 90,
		name: {
			en: "Kids' Furniture",
			ps: 'د ماشومانو فرنیچر',
			fa: 'مبلمان کودک',
		},
		parent_id: 10,
		path: 'toys-kids.kids-furniture',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Watches & Jewelry (parent 11) ────────────
	{
		id: 91,
		name: { en: "Men's Watches", ps: 'د نارینه ساعتونه', fa: 'ساعت مردانه' },
		parent_id: 11,
		path: 'watches-jewelry.mens-watches',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 92,
		name: { en: "Women's Watches", ps: 'د ښځو ساعتونه', fa: 'ساعت زنانه' },
		parent_id: 11,
		path: 'watches-jewelry.womens-watches',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 93,
		name: { en: 'Fine Jewelry', ps: 'سرې زرو زیورات', fa: 'جواهرات طلا' },
		parent_id: 11,
		path: 'watches-jewelry.fine-jewelry',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 94,
		name: {
			en: 'Fashion Jewelry',
			ps: 'فیشني زیورات',
			fa: 'جواهرات فشن',
		},
		parent_id: 11,
		path: 'watches-jewelry.fashion-jewelry',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 95,
		name: { en: 'Rings', ps: 'ګوتۍ', fa: 'حلقه‌ها' },
		parent_id: 11,
		path: 'watches-jewelry.rings',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 127,
		name: {
			en: 'Wedding Jewelry Sets',
			ps: 'د واده زیورات سیټونه',
			fa: 'ست جواهرات عروسی',
		},
		parent_id: 11,
		path: 'watches-jewelry.wedding-jewelry-sets',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
		delivery: true,
		is_popular: false,
	},

	// ──────────── Art & Crafts (parent 12) ────────────
	{
		id: 96,
		name: { en: 'Wall Art', ps: 'د دیوال انځورونه', fa: 'تابلو و نقاشی' },
		parent_id: 12,
		path: 'art-crafts.wall-art',
		depth: 1,
		sort_order: 1,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 97,
		name: { en: 'Handicrafts', ps: 'لاسي صنایع', fa: 'صنایع دستی' },
		parent_id: 12,
		path: 'art-crafts.handicrafts',
		depth: 1,
		sort_order: 2,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 98,
		name: { en: 'Carpets', ps: 'غالۍ', fa: 'قالین‌ها' },
		parent_id: 12,
		path: 'art-crafts.carpets',
		depth: 1,
		sort_order: 3,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		// Afghan carpets/rugs are a globally recognized specialty — genuinely
		// popular, not a generic filler pick.
		is_popular: true,
	},
	{
		id: 128,
		name: { en: 'Rugs', ps: 'غالیچې', fa: 'فرش‌ها' },
		parent_id: 12,
		path: 'art-crafts.rugs',
		depth: 1,
		sort_order: 4,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: true,
	},
	{
		id: 99,
		name: {
			en: 'Calligraphy & Islamic Art',
			ps: 'خطاطي او اسلامي هنر',
			fa: 'خطاطی و هنر اسلامی',
		},
		parent_id: 12,
		path: 'art-crafts.calligraphy-islamic-art',
		depth: 1,
		sort_order: 5,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 100,
		name: {
			en: 'Craft Supplies',
			ps: 'د صنایعو توکي',
			fa: 'لوازم صنایع دستی',
		},
		parent_id: 12,
		path: 'art-crafts.craft-supplies',
		depth: 1,
		sort_order: 6,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 101,
		name: { en: 'Pottery', ps: 'سفالي لوازم', fa: 'سرامیک' },
		parent_id: 12,
		path: 'art-crafts.pottery',
		depth: 1,
		sort_order: 7,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
	{
		id: 129,
		name: { en: 'Home Decor', ps: 'د کور ښایست', fa: 'دکوراسیون خانه' },
		parent_id: 12,
		path: 'art-crafts.home-decor',
		depth: 1,
		sort_order: 8,
		icon_url:
			'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
		delivery: true,
		is_popular: false,
	},
]

// ──────────────────────────────────────────────────────────────────────────
// Shared option sets — the same translated {value,label} lists get reused
// across several attributes (every "Condition" dropdown, every "Color"
// dropdown, ...) instead of retyping the same translations repeatedly.
// ──────────────────────────────────────────────────────────────────────────

const OTHER = { value: 'other', label: { en: 'Other', ps: 'نور', fa: 'دیگر' } }

const CONDITION_NEW_USED_REFURBISHED = [
	{ value: 'new', label: { en: 'New', ps: 'نوی', fa: 'نو' } },
	{ value: 'used', label: { en: 'Used', ps: 'کارول شوی', fa: 'دسته دوم' } },
	{
		value: 'refurbished',
		label: { en: 'Refurbished', ps: 'بیا رغول شوی', fa: 'نوسازی شده' },
	},
]

const CONDITION_NEW_USED = [
	{ value: 'new', label: { en: 'New', ps: 'نوی', fa: 'نو' } },
	{ value: 'used', label: { en: 'Used', ps: 'کارول شوی', fa: 'دسته دوم' } },
]

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => ({
	value: size,
	label: { en: size, ps: size, fa: size },
}))

// One shared, comprehensive color catalog for every "Color" attribute in
// the app (mobiles, clothing, furniture, ...) — mirrors Amazon's
// standardized seller color map (Beige/Black/Blue/Brass/Bronze/Brown/
// Chrome/Gold/Gray/Green/Metallic/Multicolored/Orange/Pink/Purple/Red/
// Silver/White/Yellow) plus the shades Daraz/AliExpress commonly add for
// fashion & electronics (Navy, Maroon, Teal, Olive, Turquoise, Coral,
// Lavender, Mint, Cream, Charcoal, Khaki, Rose Gold, Space Gray). Matches
// Bazar56's `PRODUCT_COLORS` catalog key-for-key.
const COLORS = [
	{ value: 'black', label: { en: 'Black', ps: 'تور', fa: 'سیاه' } },
	{ value: 'white', label: { en: 'White', ps: 'سپین', fa: 'سفید' } },
	{ value: 'gray', label: { en: 'Gray', ps: 'خړ', fa: 'خاکستری' } },
	{ value: 'red', label: { en: 'Red', ps: 'سور', fa: 'قرمز' } },
	{ value: 'orange', label: { en: 'Orange', ps: 'نارنجي', fa: 'نارنجی' } },
	{ value: 'yellow', label: { en: 'Yellow', ps: 'ژېړ', fa: 'زرد' } },
	{ value: 'green', label: { en: 'Green', ps: 'شین', fa: 'سبز' } },
	{ value: 'blue', label: { en: 'Blue', ps: 'آسمانی', fa: 'آبی' } },
	{ value: 'purple', label: { en: 'Purple', ps: 'بنفش', fa: 'بنفش' } },
	{ value: 'pink', label: { en: 'Pink', ps: 'ګلابي', fa: 'صورتی' } },
	{ value: 'brown', label: { en: 'Brown', ps: 'نسواري', fa: 'قهوه‌ای' } },
	{ value: 'gold', label: { en: 'Gold', ps: 'طلایي', fa: 'طلایی' } },
	{ value: 'silver', label: { en: 'Silver', ps: 'سپینزر', fa: 'نقره‌ای' } },
	{ value: 'beige', label: { en: 'Beige', ps: 'بېج', fa: 'بژ' } },
	{ value: 'navy', label: { en: 'Navy', ps: 'نیوي شین', fa: 'سرمه‌ای' } },
	{ value: 'maroon', label: { en: 'Maroon', ps: 'مرون', fa: 'زرشکی' } },
	{ value: 'teal', label: { en: 'Teal', ps: 'تیل شین', fa: 'سبز آبی' } },
	{ value: 'olive', label: { en: 'Olive', ps: 'زیتوني', fa: 'زیتونی' } },
	{ value: 'turquoise', label: { en: 'Turquoise', ps: 'تورکوایز', fa: 'فیروزه‌ای' } },
	{ value: 'coral', label: { en: 'Coral', ps: 'کورال', fa: 'مرجانی' } },
	{ value: 'lavender', label: { en: 'Lavender', ps: 'لاوېنډر', fa: 'بنفش روشن' } },
	{ value: 'mint', label: { en: 'Mint', ps: 'نعناع رنګ', fa: 'نعنایی' } },
	{ value: 'cream', label: { en: 'Cream', ps: 'کریمي', fa: 'کرمی' } },
	{ value: 'charcoal', label: { en: 'Charcoal', ps: 'تیاره خړ', fa: 'ذغالی' } },
	{ value: 'khaki', label: { en: 'Khaki', ps: 'خاکي', fa: 'خاکی' } },
	{ value: 'multicolor', label: { en: 'Multicolor', ps: 'ګډ رنګ', fa: 'رنگارنگ' } },
	{ value: 'rose_gold', label: { en: 'Rose Gold', ps: 'ګلابي طلایي', fa: 'رزگلد' } },
	{ value: 'space_gray', label: { en: 'Space Gray', ps: 'فضايي خړ', fa: 'خاکستری فضایی' } },
	OTHER,
]

const CLOTHING_MATERIALS = [
	{ value: 'cotton', label: { en: 'Cotton', ps: 'کاټن', fa: 'نخی' } },
	{
		value: 'polyester',
		label: { en: 'Polyester', ps: 'پولیسټر', fa: 'پلی‌استر' },
	},
	{ value: 'wool', label: { en: 'Wool', ps: 'وړۍ', fa: 'پشمی' } },
	{ value: 'silk', label: { en: 'Silk', ps: 'ورېښمینه', fa: 'ابریشمی' } },
	{ value: 'denim', label: { en: 'Denim', ps: 'ډینم', fa: 'جین' } },
	OTHER,
]

const FURNITURE_MATERIALS = [
	{ value: 'wood', label: { en: 'Wood', ps: 'لرګی', fa: 'چوبی' } },
	{ value: 'metal', label: { en: 'Metal', ps: 'فلزي', fa: 'فلزی' } },
	{ value: 'plastic', label: { en: 'Plastic', ps: 'پلاستیک', fa: 'پلاستیکی' } },
	{ value: 'glass', label: { en: 'Glass', ps: 'ګلاس', fa: 'شیشه‌ای' } },
	{ value: 'fabric', label: { en: 'Fabric', ps: 'کپړه', fa: 'پارچه‌ای' } },
]

const FURNITURE_CONDITION = [
	...CONDITION_NEW_USED_REFURBISHED.filter((o) => o.value !== 'refurbished'),
	{
		value: 'needs_repair',
		label: {
			en: 'Needs Repair',
			ps: 'د ترمیم ته اړتیا لري',
			fa: 'نیاز به تعمیر',
		},
	},
]

// `{value,label}` pairs for a plain numeral unit where the unit word itself
// is translated but the number stays as a numeral — e.g. "16GB" / "۱۶
// ګیگابایت" / "۱۶ گیگابایت".
const gbOption = (n: number) => ({
	value: `${n}GB`,
	label: {
		en: `${n}GB`,
		ps: `${n} ګیگابایت`,
		fa: `${n} گیگابایت`,
	},
})
const tbOption = (n: number) => ({
	value: `${n}TB`,
	label: {
		en: `${n}TB`,
		ps: `${n} ټیرابایت`,
		fa: `${n} ترابایت`,
	},
})

export const categoryAttributeSeedData: InsertCategoryAttribute[] = [
	// ──────────── Mobiles (13) ────────────
	{
		category_id: 13,
		code: 'brand',
		label: { en: 'Brand', ps: 'برانډ', fa: 'برند' },
		type: 'menu',
		placeholder: {
			en: 'Select brand',
			ps: 'برانډ غوره کړئ',
			fa: 'برند را انتخاب کنید',
		},
		menu_data: [
			{ value: 'samsung', label: { en: 'Samsung', ps: 'Samsung', fa: 'Samsung' } },
			{ value: 'apple', label: { en: 'Apple', ps: 'Apple', fa: 'Apple' } },
			{ value: 'xiaomi', label: { en: 'Xiaomi', ps: 'Xiaomi', fa: 'Xiaomi' } },
			{ value: 'huawei', label: { en: 'Huawei', ps: 'Huawei', fa: 'Huawei' } },
			{ value: 'infinix', label: { en: 'Infinix', ps: 'Infinix', fa: 'Infinix' } },
			{ value: 'tecno', label: { en: 'Tecno', ps: 'Tecno', fa: 'Tecno' } },
			{ value: 'nokia', label: { en: 'Nokia', ps: 'Nokia', fa: 'Nokia' } },
			OTHER,
		],
		sort_order: 1,
	},
	{
		category_id: 13,
		code: 'ram',
		label: { en: 'RAM', ps: 'رام', fa: 'رم' },
		type: 'menu',
		placeholder: {
			en: 'Select RAM',
			ps: 'رام غوره کړئ',
			fa: 'رم را انتخاب کنید',
		},
		menu_data: [2, 3, 4, 6, 8, 12, 16].map(gbOption),
		// a listing can be offered in more than one RAM configuration.
		multiple: true,
		sort_order: 2,
	},
	{
		category_id: 13,
		code: 'storage',
		label: { en: 'Storage', ps: 'ذخیره ساتنه', fa: 'حافظه ذخیره‌سازی' },
		type: 'menu',
		placeholder: {
			en: 'Select storage',
			ps: 'ذخیره ساتنه غوره کړئ',
			fa: 'حافظه ذخیره‌سازی را انتخاب کنید',
		},
		menu_data: [
			...[16, 32, 64, 128, 256, 512].map(gbOption),
			tbOption(1),
		],
		multiple: true,
		sort_order: 3,
	},
	{
		category_id: 13,
		code: 'condition',
		label: { en: 'Condition', ps: 'حالت', fa: 'وضعیت' },
		type: 'menu',
		placeholder: {
			en: 'Select condition',
			ps: 'حالت غوره کړئ',
			fa: 'وضعیت را انتخاب کنید',
		},
		menu_data: CONDITION_NEW_USED_REFURBISHED,
		sort_order: 4,
	},
	{
		category_id: 13,
		code: 'color',
		label: { en: 'Color', ps: 'رنگ', fa: 'رنگ' },
		type: 'menu',
		placeholder: {
			en: 'Select color',
			ps: 'رنگ غوره کړئ',
			fa: 'رنگ را انتخاب کنید',
		},
		menu_data: COLORS,
		// a store can stock this model in several color options at once.
		multiple: true,
		sort_order: 5,
	},
	{
		category_id: 13,
		code: 'network',
		label: { en: 'Network', ps: 'شبکه', fa: 'شبکه' },
		type: 'menu',
		placeholder: {
			en: 'Select network',
			ps: 'شبکه غوره کړئ',
			fa: 'شبکه را انتخاب کنید',
		},
		menu_data: ['3G', '4G', '5G'].map((g) => ({
			value: g,
			label: { en: g, ps: g, fa: g },
		})),
		// a listing can support more than one network generation.
		multiple: true,
		sort_order: 6,
	},

	// ──────────── Laptops (14) ────────────
	{
		category_id: 14,
		code: 'brand',
		label: { en: 'Brand', ps: 'برانډ', fa: 'برند' },
		type: 'menu',
		placeholder: {
			en: 'Select brand',
			ps: 'برانډ غوره کړئ',
			fa: 'برند را انتخاب کنید',
		},
		menu_data: [
			{ value: 'hp', label: { en: 'HP', ps: 'HP', fa: 'HP' } },
			{ value: 'dell', label: { en: 'Dell', ps: 'Dell', fa: 'Dell' } },
			{ value: 'lenovo', label: { en: 'Lenovo', ps: 'Lenovo', fa: 'Lenovo' } },
			{ value: 'asus', label: { en: 'Asus', ps: 'Asus', fa: 'Asus' } },
			{ value: 'apple', label: { en: 'Apple', ps: 'Apple', fa: 'Apple' } },
			{ value: 'acer', label: { en: 'Acer', ps: 'Acer', fa: 'Acer' } },
			{ value: 'msi', label: { en: 'MSI', ps: 'MSI', fa: 'MSI' } },
			OTHER,
		],
		sort_order: 1,
	},
	{
		category_id: 14,
		code: 'processor',
		label: { en: 'Processor', ps: 'پروسیسر', fa: 'پردازنده' },
		type: 'menu',
		placeholder: {
			en: 'Select processor',
			ps: 'پروسیسر غوره کړئ',
			fa: 'پردازنده را انتخاب کنید',
		},
		menu_data: [
			{ value: 'intel_i3', label: { en: 'Intel Core i3', ps: 'Intel Core i3', fa: 'Intel Core i3' } },
			{ value: 'intel_i5', label: { en: 'Intel Core i5', ps: 'Intel Core i5', fa: 'Intel Core i5' } },
			{ value: 'intel_i7', label: { en: 'Intel Core i7', ps: 'Intel Core i7', fa: 'Intel Core i7' } },
			{ value: 'intel_i9', label: { en: 'Intel Core i9', ps: 'Intel Core i9', fa: 'Intel Core i9' } },
			{ value: 'amd_ryzen3', label: { en: 'AMD Ryzen 3', ps: 'AMD Ryzen 3', fa: 'AMD Ryzen 3' } },
			{ value: 'amd_ryzen5', label: { en: 'AMD Ryzen 5', ps: 'AMD Ryzen 5', fa: 'AMD Ryzen 5' } },
			{ value: 'amd_ryzen7', label: { en: 'AMD Ryzen 7', ps: 'AMD Ryzen 7', fa: 'AMD Ryzen 7' } },
			{ value: 'apple_m', label: { en: 'Apple M-series', ps: 'Apple M-series', fa: 'Apple M-series' } },
			OTHER,
		],
		// a listing can be offered with more than one processor option.
		multiple: true,
		sort_order: 2,
	},
	{
		category_id: 14,
		code: 'ram',
		label: { en: 'RAM', ps: 'رام', fa: 'رم' },
		type: 'menu',
		placeholder: {
			en: 'Select RAM',
			ps: 'رام غوره کړئ',
			fa: 'رم را انتخاب کنید',
		},
		menu_data: [4, 8, 16, 32, 64].map(gbOption),
		multiple: true,
		sort_order: 3,
	},
	{
		category_id: 14,
		code: 'storage',
		label: { en: 'Storage', ps: 'ذخیره ساتنه', fa: 'حافظه ذخیره‌سازی' },
		type: 'menu',
		placeholder: {
			en: 'Select storage',
			ps: 'ذخیره ساتنه غوره کړئ',
			fa: 'حافظه ذخیره‌سازی را انتخاب کنید',
		},
		menu_data: [128, 256, 512].map((n) => ({
			value: `${n}GB_SSD`,
			label: {
				en: `${n}GB SSD`,
				ps: `${n} ګیگابایت SSD`,
				fa: `${n} گیگابایت SSD`,
			},
		})).concat([
			{
				value: '1TB_SSD',
				label: { en: '1TB SSD', ps: '۱ ټیرابایت SSD', fa: '۱ ترابایت SSD' },
			},
			{
				value: '500GB_HDD',
				label: { en: '500GB HDD', ps: '۵۰۰ ګیگابایت HDD', fa: '۵۰۰ گیگابایت HDD' },
			},
			{
				value: '1TB_HDD',
				label: { en: '1TB HDD', ps: '۱ ټیرابایت HDD', fa: '۱ ترابایت HDD' },
			},
		]),
		multiple: true,
		sort_order: 4,
	},
	{
		category_id: 14,
		code: 'screen_size',
		label: { en: 'Screen Size', ps: 'د سکرین اندازه', fa: 'اندازه صفحه نمایش' },
		type: 'menu',
		placeholder: {
			en: 'Select screen size',
			ps: 'د سکرین اندازه غوره کړئ',
			fa: 'اندازه صفحه نمایش را انتخاب کنید',
		},
		menu_data: [
			{
				value: '11-13',
				label: { en: '11"–13"', ps: '۱۱–۱۳ انچ', fa: '۱۱ تا ۱۳ اینچ' },
			},
			{
				value: '14-15',
				label: { en: '14"–15"', ps: '۱۴–۱۵ انچ', fa: '۱۴ تا ۱۵ اینچ' },
			},
			{ value: '16+', label: { en: '16"+', ps: '۱۶+ انچ', fa: '۱۶ اینچ به بالا' } },
		],
		multiple: true,
		sort_order: 5,
	},
	{
		category_id: 14,
		code: 'graphics',
		label: { en: 'Graphics', ps: 'ګرافیک', fa: 'گرافیک' },
		type: 'menu',
		placeholder: {
			en: 'Select graphics',
			ps: 'ګرافیک غوره کړئ',
			fa: 'گرافیک را انتخاب کنید',
		},
		menu_data: [
			{
				value: 'integrated',
				label: { en: 'Integrated', ps: 'ضمیمه شوی', fa: 'یکپارچه' },
			},
			{
				value: 'dedicated',
				label: { en: 'Dedicated', ps: 'جلا شوی', fa: 'اختصاصی' },
			},
		],
		multiple: true,
		sort_order: 6,
	},
	{
		category_id: 14,
		code: 'condition',
		label: { en: 'Condition', ps: 'حالت', fa: 'وضعیت' },
		type: 'menu',
		placeholder: {
			en: 'Select condition',
			ps: 'حالت غوره کړئ',
			fa: 'وضعیت را انتخاب کنید',
		},
		menu_data: CONDITION_NEW_USED_REFURBISHED,
		sort_order: 7,
	},
	{
		category_id: 14,
		code: 'color',
		label: { en: 'Color', ps: 'رنگ', fa: 'رنگ' },
		type: 'menu',
		placeholder: { en: 'Select color', ps: 'رنگ غوره کړئ', fa: 'رنگ را انتخاب کنید' },
		menu_data: COLORS,
		// a store can stock this model in several color options at once.
		multiple: true,
		sort_order: 8,
	},

	// ──────────── Cars (41) ────────────
	{
		category_id: 41,
		code: 'make',
		label: { en: 'Make', ps: 'برانډ', fa: 'برند' },
		type: 'menu',
		placeholder: {
			en: 'Select make',
			ps: 'برانډ غوره کړئ',
			fa: 'برند را انتخاب کنید',
		},
		menu_data: [
			{ value: 'toyota', label: { en: 'Toyota', ps: 'Toyota', fa: 'Toyota' } },
			{ value: 'honda', label: { en: 'Honda', ps: 'Honda', fa: 'Honda' } },
			{ value: 'suzuki', label: { en: 'Suzuki', ps: 'Suzuki', fa: 'Suzuki' } },
			{ value: 'nissan', label: { en: 'Nissan', ps: 'Nissan', fa: 'Nissan' } },
			OTHER,
		],
		sort_order: 1,
	},
	{
		category_id: 41,
		code: 'model',
		label: { en: 'Model', ps: 'ماډل', fa: 'مدل' },
		// too many models per make to enumerate in a menu (Corolla, Civic,
		// Alto, ...) — free text instead, like a real listing form would ask.
		type: 'text',
		placeholder: { en: 'e.g. Corolla', ps: 'د بیلګې په توګه Corolla', fa: 'مثلاً Corolla' },
		menu_data: null,
		sort_order: 2,
	},
	{
		category_id: 41,
		code: 'body_type',
		label: { en: 'Body Type', ps: 'د بدن ډول', fa: 'نوع بدنه' },
		type: 'menu',
		placeholder: {
			en: 'Select body type',
			ps: 'د بدن ډول غوره کړئ',
			fa: 'نوع بدنه را انتخاب کنید',
		},
		menu_data: [
			{ value: 'sedan', label: { en: 'Sedan', ps: 'سیدان', fa: 'سدان' } },
			{ value: 'suv', label: { en: 'SUV', ps: 'SUV', fa: 'شاسی‌بلند' } },
			{ value: 'hatchback', label: { en: 'Hatchback', ps: 'هیچبک', fa: 'هاچبک' } },
			{ value: 'pickup', label: { en: 'Pickup', ps: 'پیکپ', fa: 'پیکاپ' } },
			{ value: 'van', label: { en: 'Van', ps: 'ون', fa: 'ون' } },
			{ value: 'coupe', label: { en: 'Coupe', ps: 'کوپ', fa: 'کوپه' } },
			OTHER,
		],
		sort_order: 3,
	},
	{
		category_id: 41,
		code: 'year',
		label: { en: 'Year', ps: 'کال', fa: 'سال' },
		type: 'number',
		placeholder: { en: 'e.g. 2018', ps: 'د بیلګې په توګه ۲۰۱۸', fa: 'مثلاً ۲۰۱۸' },
		menu_data: null,
		sort_order: 4,
	},
	{
		category_id: 41,
		code: 'transmission',
		label: { en: 'Transmission', ps: 'ترانسمیشن', fa: 'گیربکس' },
		type: 'menu',
		placeholder: {
			en: 'Select transmission',
			ps: 'ترانسمیشن غوره کړئ',
			fa: 'گیربکس را انتخاب کنید',
		},
		menu_data: [
			{ value: 'automatic', label: { en: 'Automatic', ps: 'اتومات', fa: 'اتومات' } },
			{ value: 'manual', label: { en: 'Manual', ps: 'لاسي', fa: 'دستی' } },
		],
		sort_order: 5,
	},
	{
		category_id: 41,
		code: 'fuel_type',
		label: { en: 'Fuel Type', ps: 'د تیلو ډول', fa: 'نوع سوخت' },
		type: 'menu',
		placeholder: {
			en: 'Select fuel type',
			ps: 'د تیلو ډول غوره کړئ',
			fa: 'نوع سوخت را انتخاب کنید',
		},
		menu_data: [
			{ value: 'petrol', label: { en: 'Petrol', ps: 'پطرول', fa: 'پترول' } },
			{ value: 'diesel', label: { en: 'Diesel', ps: 'ډیزل', fa: 'دیزل' } },
			{ value: 'hybrid', label: { en: 'Hybrid', ps: 'هایبرید', fa: 'هیبرید' } },
			{ value: 'electric', label: { en: 'Electric', ps: 'بریښنایی', fa: 'برقی' } },
			{ value: 'cng', label: { en: 'CNG', ps: 'CNG', fa: 'CNG' } },
		],
		sort_order: 6,
	},
	{
		category_id: 41,
		code: 'color',
		label: { en: 'Color', ps: 'رنگ', fa: 'رنگ' },
		type: 'menu',
		placeholder: { en: 'Select color', ps: 'رنگ غوره کړئ', fa: 'رنگ را انتخاب کنید' },
		menu_data: COLORS,
		// one specific car has exactly one exterior color.
		sort_order: 7,
	},
	{
		category_id: 41,
		code: 'condition',
		label: { en: 'Condition', ps: 'حالت', fa: 'وضعیت' },
		type: 'menu',
		placeholder: {
			en: 'Select condition',
			ps: 'حالت غوره کړئ',
			fa: 'وضعیت را انتخاب کنید',
		},
		menu_data: CONDITION_NEW_USED,
		sort_order: 8,
	},
	{
		category_id: 41,
		code: 'mileage',
		label: { en: 'Mileage (km)', ps: 'طی شوې مسافه (کیلومتر)', fa: 'کیلومتر طی شده' },
		type: 'number',
		placeholder: { en: 'e.g. 50000', ps: 'د بیلګې په توګه ۵۰۰۰۰', fa: 'مثلاً ۵۰۰۰۰' },
		menu_data: null,
		sort_order: 9,
	},

	// ──────────── Real estate: `purpose` (for sale / for rent / mortgage) on
	// every property-type leaf (25, 26, 29, 30, 31, 32, 109) — this is what
	// replaced the old per-purpose categories (the separate "...for Rent"
	// leaves). 109 (Offices) is the split-off half of the old "Shops &
	// Offices" (31 "Shops" is the other half, keeping its original row). ────────────
	...[25, 26, 29, 30, 31, 32, 109].map((category_id) => ({
		category_id,
		code: 'purpose',
		label: { en: 'Purpose', ps: 'هدف', fa: 'هدف' },
		type: 'menu',
		placeholder: {
			en: 'Select purpose',
			ps: 'هدف غوره کړئ',
			fa: 'هدف را انتخاب کنید',
		},
		menu_data: [
			{ value: 'for_sale', label: { en: 'For Sale', ps: 'د پلورلو لپاره', fa: 'برای فروش' } },
			{ value: 'for_rent', label: { en: 'For Rent', ps: 'د کرایې لپاره', fa: 'برای کرایه' } },
			{ value: 'mortgage', label: { en: 'Mortgage', ps: 'ګروي', fa: 'گروی' } },
		],
		sort_order: 0,
	}) satisfies InsertCategoryAttribute),

	// Land & Plots (29), Commercial (30), Shops (31), Offices (109), Guest
	// Houses (32) — just area; House/Apartment (25, 26) get their own
	// richer area_sqm below alongside bedrooms/bathrooms/furnishing.
	...[29, 30, 31, 109, 32].map((category_id) => ({
		category_id,
		code: 'area_sqm',
		label: { en: 'Area (m²)', ps: 'مساحت (مترمربع)', fa: 'مساحت (متر مربع)' },
		type: 'number',
		placeholder: { en: 'e.g. 120', ps: 'د بیلګې په توګه ۱۲۰', fa: 'مثلاً ۱۲۰' },
		menu_data: null,
		sort_order: 1,
	}) satisfies InsertCategoryAttribute),

	// House (25) & Apartment (26) only — same 4 detail attributes on both.
	...[25, 26].flatMap((category_id) => [
		{
			category_id,
			code: 'bedrooms',
			label: { en: 'Bedrooms', ps: 'د خوب خونې', fa: 'تعداد اتاق خواب' },
			type: 'number',
			placeholder: {
				en: 'e.g. 3',
				ps: 'د بیلګې په توګه ۳',
				fa: 'مثلاً ۳',
			},
			menu_data: null,
			sort_order: 1,
		},
		{
			category_id,
			code: 'bathrooms',
			label: { en: 'Bathrooms', ps: 'تشناب', fa: 'تعداد سرویس بهداشتی' },
			type: 'number',
			placeholder: {
				en: 'e.g. 2',
				ps: 'د بیلګې په توګه ۲',
				fa: 'مثلاً ۲',
			},
			menu_data: null,
			sort_order: 2,
		},
		{
			category_id,
			code: 'area_sqm',
			label: { en: 'Area (m²)', ps: 'مساحت (مترمربع)', fa: 'مساحت (متر مربع)' },
			type: 'number',
			placeholder: { en: 'e.g. 120', ps: 'د بیلګې په توګه ۱۲۰', fa: 'مثلاً ۱۲۰' },
			menu_data: null,
			sort_order: 3,
		},
		{
			category_id,
			code: 'furnishing',
			label: { en: 'Furnishing', ps: 'فرنیچر حالت', fa: 'وضعیت مبلمان' },
			type: 'menu',
			placeholder: {
				en: 'Select furnishing',
				ps: 'فرنیچر حالت غوره کړئ',
				fa: 'وضعیت مبلمان را انتخاب کنید',
			},
			menu_data: [
				{
					value: 'furnished',
					label: { en: 'Furnished', ps: 'فرنیچر شوی', fa: 'مبله' },
				},
				{
					value: 'semi_furnished',
					label: { en: 'Semi-furnished', ps: 'نیمه فرنیچر شوی', fa: 'نیمه مبله' },
				},
				{
					value: 'unfurnished',
					label: { en: 'Unfurnished', ps: 'غیر فرنیچر شوی', fa: 'بدون مبل' },
				},
			],
			sort_order: 4,
		},
	] satisfies InsertCategoryAttribute[]),

	// ──────────── Men's Clothing (33) / Women's Clothing (34) — same 4
	// attributes on both. ────────────
	...[33, 34].flatMap((category_id) => [
		{
			category_id,
			code: 'size',
			label: { en: 'Size', ps: 'سایز', fa: 'سایز' },
			type: 'menu',
			placeholder: { en: 'Select size', ps: 'سایز غوره کړئ', fa: 'سایز را انتخاب کنید' },
			menu_data: CLOTHING_SIZES,
			// a listing can be offered in more than one size.
			multiple: true,
			sort_order: 1,
		},
		{
			category_id,
			code: 'color',
			label: { en: 'Color', ps: 'رنگ', fa: 'رنگ' },
			type: 'menu',
			placeholder: { en: 'Select color', ps: 'رنگ غوره کړئ', fa: 'رنگ را انتخاب کنید' },
			menu_data: COLORS,
			multiple: true,
			sort_order: 2,
		},
		{
			category_id,
			code: 'material',
			label: { en: 'Material', ps: 'جنس', fa: 'جنس' },
			type: 'menu',
			placeholder: {
				en: 'Select material',
				ps: 'جنس غوره کړئ',
				fa: 'جنس را انتخاب کنید',
			},
			menu_data: CLOTHING_MATERIALS,
			sort_order: 3,
		},
		{
			category_id,
			code: 'condition',
			label: { en: 'Condition', ps: 'حالت', fa: 'وضعیت' },
			type: 'menu',
			placeholder: {
				en: 'Select condition',
				ps: 'حالت غوره کړئ',
				fa: 'وضعیت را انتخاب کنید',
			},
			menu_data: CONDITION_NEW_USED,
			sort_order: 4,
		},
	] satisfies InsertCategoryAttribute[]),

	// ──────────── Furniture leaves (48–54) — same 3 attributes on all 7.
	// ────────────
	...[48, 49, 50, 51, 52, 53, 54].flatMap((category_id) => [
		{
			category_id,
			code: 'material',
			label: { en: 'Material', ps: 'جنس', fa: 'جنس' },
			type: 'menu',
			placeholder: {
				en: 'Select material',
				ps: 'جنس غوره کړئ',
				fa: 'جنس را انتخاب کنید',
			},
			menu_data: FURNITURE_MATERIALS,
			sort_order: 1,
		},
		{
			category_id,
			code: 'color',
			label: { en: 'Color', ps: 'رنگ', fa: 'رنگ' },
			type: 'menu',
			placeholder: { en: 'Select color', ps: 'رنگ غوره کړئ', fa: 'رنگ را انتخاب کنید' },
			menu_data: COLORS,
			multiple: true,
			sort_order: 2,
		},
		{
			category_id,
			code: 'condition',
			label: { en: 'Condition', ps: 'حالت', fa: 'وضعیت' },
			type: 'menu',
			placeholder: {
				en: 'Select condition',
				ps: 'حالت غوره کړئ',
				fa: 'وضعیت را انتخاب کنید',
			},
			menu_data: FURNITURE_CONDITION,
			sort_order: 3,
		},
	] satisfies InsertCategoryAttribute[]),
]
