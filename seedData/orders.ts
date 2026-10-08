import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/db'
import {
	addresses,
	orderItems,
	orders,
	products,
	provinces,
	users,
} from '../src/db/schema'
import type { ProductImage } from '../src/utils/types'

type OrderStatus =
	| 'pending'
	| 'confirmed'
	| 'processing'
	| 'shipped'
	| 'delivered'
	| 'cancelled'
	| 'returned'

type OrderInsert = typeof orders.$inferInsert
type OrderItemInsert = typeof orderItems.$inferInsert

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function firstImageUrl(images: unknown): string | null {
	const imgs = (images as ProductImage[]) ?? []
	const primary = imgs.find((i) => i.is_primary) ?? imgs[0]
	return primary?.url ?? null
}

function genOrderNumber(i: number): string {
	const time = Date.now().toString(36).toUpperCase()
	const rand = faker.string.alphanumeric(4).toUpperCase()
	return `ORD-${time}-${i}-${rand}`
}

// Pick a status with a realistic distribution.
function pickStatus(): OrderStatus {
	return faker.helpers.weightedArrayElement<OrderStatus>([
		{ value: 'delivered', weight: 35 },
		{ value: 'pending', weight: 15 },
		{ value: 'shipped', weight: 13 },
		{ value: 'cancelled', weight: 12 },
		{ value: 'confirmed', weight: 10 },
		{ value: 'processing', weight: 10 },
		{ value: 'returned', weight: 5 },
	])
}

export async function generateOrdersFakerData(count = 30) {
	// Real rows so the snapshots and FKs are valid.
	const productRows = await db
		.select({
			id: products.id,
			store_id: products.store_id,
			title: products.title,
			price: products.price,
			currency: products.currency,
			images: products.images,
		})
		.from(products)

	const addressRows = await db
		.select({
			id: addresses.id,
			user_id: addresses.user_id,
			province_id: addresses.province_id,
			district: addresses.district,
			address_line: addresses.address_line,
			latitude: addresses.latitude,
			longitude: addresses.longitude,
			buyer_name: users.name,
			buyer_phone: users.phone,
			province_name: provinces.name,
		})
		.from(addresses)
		.innerJoin(users, eq(users.id, addresses.user_id))
		.innerJoin(provinces, eq(provinces.id, addresses.province_id))

	if (productRows.length === 0 || addressRows.length === 0) {
		console.log('⏭️  Skipping orders: need products and addresses first.')
		return []
	}

	// Group products by store so each order stays within a single store.
	const productsByStore = new Map<number, typeof productRows>()
	for (const p of productRows) {
		const arr = productsByStore.get(p.store_id) ?? []
		arr.push(p)
		productsByStore.set(p.store_id, arr)
	}
	const storeIds = [...productsByStore.keys()]

	const orderValues: OrderInsert[] = []
	// Items are kept in lock-step with orderValues; order_id is filled after insert.
	const itemsPerOrder: Omit<OrderItemInsert, 'order_id'>[][] = []

	for (let i = 0; i < count; i++) {
		const storeId = faker.helpers.arrayElement(storeIds)
		const storeProducts = productsByStore.get(storeId) ?? []
		if (storeProducts.length === 0) continue

		// Keep a single currency per order (matches the checkout rule).
		const currency = faker.helpers.arrayElement(storeProducts).currency
		const candidates = storeProducts.filter((p) => p.currency === currency)

		const lineCount = faker.number.int({
			min: 1,
			max: Math.min(4, candidates.length),
		})
		const chosen = faker.helpers.arrayElements(candidates, lineCount)

		let subtotal = 0
		let itemCount = 0
		const items: Omit<OrderItemInsert, 'order_id'>[] = chosen.map((p) => {
			const qty = faker.number.int({ min: 1, max: 3 })
			const line = round2(Number(p.price) * qty)
			subtotal = round2(subtotal + line)
			itemCount += qty
			return {
				product_id: p.id,
				title: p.title,
				image: firstImageUrl(p.images),
				unit_price: p.price,
				currency: p.currency,
				quantity: qty,
				subtotal: line.toFixed(2),
			}
		})

		const address = faker.helpers.arrayElement(addressRows)
		const status = pickStatus()
		const createdAt = faker.date.recent({ days: 60 })

		// Derive lifecycle timestamps + payment status from the order status.
		const reached = (...s: OrderStatus[]) => s.includes(status)
		const confirmedAt = reached(
			'confirmed',
			'processing',
			'shipped',
			'delivered',
			'returned',
		)
			? faker.date.soon({ days: 1, refDate: createdAt })
			: null
		const shippedAt = reached('shipped', 'delivered', 'returned')
			? faker.date.soon({ days: 2, refDate: confirmedAt ?? createdAt })
			: null
		const deliveredAt = reached('delivered', 'returned')
			? faker.date.soon({ days: 3, refDate: shippedAt ?? createdAt })
			: null
		const cancelledAt =
			status === 'cancelled'
				? faker.date.soon({ days: 2, refDate: createdAt })
				: null

		let paymentStatus: 'unpaid' | 'paid' | 'refunded' = 'unpaid'
		if (reached('delivered')) paymentStatus = 'paid'
		else if (status === 'returned') paymentStatus = 'refunded'

		orderValues.push({
			order_number: genOrderNumber(i),
			checkout_group_id: faker.string.uuid(),
			buyer_id: address.user_id,
			store_id: storeId,
			status,
			payment_method: faker.helpers.weightedArrayElement([
				{ value: 'cash_on_delivery', weight: 85 },
				{ value: 'bank_transfer', weight: 15 },
			]),
			payment_status: paymentStatus,
			currency,
			subtotal: subtotal.toFixed(2),
			total: subtotal.toFixed(2),
			item_count: itemCount,
			shipping_address_id: address.id,
			shipping_address: {
				name: address.buyer_name,
				phone: address.buyer_phone,
				province_id: address.province_id,
				province_name: address.province_name,
				district: address.district,
				address_line: address.address_line,
				latitude: address.latitude,
				longitude: address.longitude,
			},
			buyer_note: faker.datatype.boolean({ probability: 0.3 })
				? faker.lorem.sentence()
				: null,
			cancel_reason: status === 'cancelled' ? faker.lorem.sentence() : null,
			confirmed_at: confirmedAt,
			shipped_at: shippedAt,
			delivered_at: deliveredAt,
			cancelled_at: cancelledAt,
			created_at: createdAt,
			updated_at:
				deliveredAt ?? shippedAt ?? confirmedAt ?? cancelledAt ?? createdAt,
		})
		itemsPerOrder.push(items)
	}

	if (orderValues.length === 0) return []

	// Insert orders, then attach their items by aligned index.
	const inserted = await db
		.insert(orders)
		.values(orderValues)
		.returning({ id: orders.id })

	const allItems: OrderItemInsert[] = []
	inserted.forEach((row, idx) => {
		for (const item of itemsPerOrder[idx] ?? []) {
			allItems.push({ ...item, order_id: row.id })
		}
	})
	if (allItems.length > 0) await db.insert(orderItems).values(allItems)

	console.log(
		`📦 Seeded ${inserted.length} orders with ${allItems.length} items.`,
	)
	return inserted
}
