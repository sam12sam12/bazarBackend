import { faker } from '@faker-js/faker'

// Real, topically-correct Unsplash photos per category — curated the same
// way as the Vehicles department icon fix (search Unsplash, extract the CDN
// photo id, spot-checked by actually viewing a sample). Covers the ~19 leaf
// categories that get real generated specs/titles in products.ts (the
// "first pass" category_attribute set — see getCategoryAttributesByCategory
// in index.ts) since those are the categories that actually get seeded
// products in any real volume. Every other leaf category has no pool here;
// `randomProductImages` below falls back to that category's own `icon_url`
// (already a real, correctly-matched single photo) instead of a random,
// category-blind stock photo.
export const CATEGORY_IMAGE_IDS: Record<number, string[]> = {
	13: [
		// Mobiles
		'1592890288564-76628a30a657',
		'1772831902679-3f41c106d7a2',
		'1511707171634-5f897ff02aa9',
		'1773332598501-f8612761781a',
		'1598327105666-5b89351aff97',
	],
	14: [
		// Laptops
		'1649972904349-6e44c42644a7',
		'1773332611612-ffdaa753afb1',
		'1496181133206-80ce9b88a853',
		'1773332585698-cba3c91b73e4',
		'1525547719571-a2d4ac8945e2',
	],
	25: [
		// House
		'1570129477492-45c003edd2be',
		'1781797221329-c3d083ab6d99',
		'1600596542815-ffad4c1539a9',
		'1598228723793-52759bba239c',
		'1580587771525-78b9dba3b914',
	],
	26: [
		// Apartment
		'1522708323590-d24dbb6b0267',
		'1757524503555-b62633f47670',
		'1502672260266-1c1ef2d93688',
		'1773578978637-c9771e7a9913',
		'1560448204-e02f11c3d0e2',
	],
	29: [
		// Land & Plots
		'1697627903173-e22b6e04734d',
		'1780912206333-eda911e4eca5',
		'1626834478854-9b5aefd826fd',
		'1777268209440-296c2bb6facf',
		'1764223531702-1614efb82e40',
	],
	30: [
		// Commercial Property
		'1486406146926-c627a92ad1ab',
		'1780417819796-c28f3951a39c',
		'1512403754473-27835f7b9984',
		'1497366754035-f200968a6e72',
		'1518005020951-eccb494ad742',
	],
	31: [
		// Shops
		'1605513524006-063ed6ed31e7',
		'1602254992120-5b3c3dad1d9d',
		'1563899911-1cd41c199d2a',
		'1734576861113-8dcab61bc59d',
		'1719586902338-bbfa49db95fc',
	],
	32: [
		// Guest Houses
		'1772365833604-850c93d327cb',
		'1778603485048-40732ec80dfe',
		'1787525500357-f6cdf0cb092b',
		'1785481043905-0c9e05ff3a7b',
		'1791275797358-ca636ba27e61',
	],
	33: [
		// Men's Clothing
		'1441984904996-e0b6ba687e04',
		'1782227282777-31e421d02eaf',
		'1562157873-818bc0726f68',
		'1489987707025-afc232f7ea0f',
		'1667284152861-36e03571486a',
	],
	34: [
		// Women's Clothing
		'1525507119028-ed4c629a60a3',
		'1767968037382-8eb9c564339f',
		'1558769132-cb1aea458c5e',
		'1532453288672-3a27e9be9efd',
		'1786118791511-0252f7c4f156',
	],
	41: [
		// Cars
		'1580273916550-e323be2ae537',
		'1765211003784-a82564cb8d3d',
		'1503376780353-7e6692767b70',
		'1779184638442-fcbd65b0437a',
		'1786245134362-eb644f448a5e',
	],
	48: [
		// Living Room Furniture
		'1631679706909-1844bbd07221',
		'1784790601988-7915393bc5a1',
		'1583847268964-b28dc8f51f92',
		'1779078652921-44629ffbcd07',
		'1632829882891-5047ccc421bc',
	],
	49: [
		// Bedroom Furniture
		'1505693416388-ac5ce068fe85',
		'1779903726446-6f796d533d47',
		'1522771739844-6a9f6d5f14af',
		'1765862835319-18fb6f8caff6',
		'1616486029423-aaa4789e8c9a',
	],
	50: [
		// Office Furniture
		'1524758631624-e2822e304c36',
		'1770316320132-e082373dd3f6',
		'1497366811353-6870744d04b2',
		'1765371514743-45bd8e6c0a28',
		'1571624436279-b272aff752b5',
	],
	51: [
		// Dining Furniture
		'1604578762246-41134e37f9cc',
		'1758977404039-6e834be8eca8',
		'1657524398377-567034729507',
		'1788104317221-e85195344eb2',
		'1616486886892-ff366aa67ba4',
	],
	52: [
		// Outdoor Furniture
		'1613685302957-3a6fc45346ef',
		'1621506821957-1b50ab7787a4',
		'1600210492090-a159ffa3aeaf',
		'1533391120950-2d65c72e5969',
		'1621506821950-f5c98fa9ff62',
	],
	53: [
		// Storage & Organization
		'1644079446600-219068676743',
		'1758609554462-c415542ce531',
		'1758609554326-ebf110a4c142',
		'1601602899110-201f02bd3cc2',
		'1736507748808-31bb64ce6fcc',
	],
	54: [
		// Mattresses
		'1505693416388-ac5ce068fe85',
		'1762199904138-d163fe89540a',
		'1635594202056-9ea3b497e5c0',
		'1762199904064-56ddc38eda99',
		'1552650272-b8a34e21bc4b',
	],
	109: [
		// Offices
		'1497366811353-6870744d04b2',
		'1780639681568-0e71735c3d27',
		'1497215728101-856f4ea42174',
		'1763306934305-39de4bbf19d9',
		'1497366754035-f200968a6e72',
	],
}

function unsplashUrl(photoId: string, width: number, height: number): string {
	return `https://images.unsplash.com/photo-${photoId}?w=${width}&h=${height}&fit=crop`
}

/** `count` product photo URLs for the given category — drawn from its real,
 * topically-matched curated pool when one exists; otherwise falls back to
 * repeating that category's own `icon_url` (still a real, correct photo,
 * just not varied) rather than a random category-blind stock image. */
export function randomProductImageUrls(
	categoryId: number,
	categoryIconUrl: string | null,
	count: number,
): string[] {
	const pool = CATEGORY_IMAGE_IDS[categoryId]
	if (pool && pool.length > 0) {
		const picks =
			count <= pool.length
				? faker.helpers.arrayElements(pool, count)
				: Array.from({ length: count }, () => faker.helpers.arrayElement(pool))
		return picks.map((id) => unsplashUrl(id, 800, 600))
	}
	if (categoryIconUrl)
		return Array.from({ length: count }, () => categoryIconUrl)
	return Array.from({ length: count }, () =>
		unsplashUrl('1472851294608-062f824d29cc', 800, 600),
	)
}
