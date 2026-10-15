import { and, desc, eq, inArray, lt, or, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import {
	addresses,
	orderItems,
	orders,
	products,
	stores,
	users,
} from '../db/schema'
import type { Checkout } from '../db/validation'
import { ApiError } from '../utils/ApiError'
import type { CursorData } from '../utils/pagination'
import type { ProductImage } from '../utils/types'
import { notificationDispatchService } from './notificationDispatchService'

// ==================== HELPERS ====================

type OrderStatus =
	| 'pending'
	| 'confirmed'
	| 'processing'
	| 'shipped'
	| 'delivered'
	| 'cancelled'
	| 'returned'

// Allowed status transitions (state machine). Empty array = terminal.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pending: ['confirmed', 'cancelled'],
	confirmed: ['processing', 'cancelled'],
	processing: ['shipped', 'cancelled'],
	shipped: ['delivered'],
	delivered: ['returned'],
	cancelled: [],
	returned: [],
}

// Maps a destination status to the timestamp column it stamps.
const STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
	confirmed: 'confirmed_at',
	shipped: 'shipped_at',
	delivered: 'delivered_at',
	cancelled: 'cancelled_at',
}

// Money is stored as numeric (returned as strings). Compute with numbers and
// round to 2 decimals to avoid float drift, then store as a fixed string.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function firstImageUrl(images: unknown): string | null {
	const imgs = (images as ProductImage[]) ?? []
	const primary = imgs.find((i) => i.is_primary) ?? imgs[0]
	return primary?.url ?? null
}

// Short, human-readable, unique-enough reference, e.g. "ORD-LXY39F2A-K3P1" —
// `order_number` is varchar(30) with a unique index, so this must stay well
// under that (the raw UUID form used previously was 40 chars and overflowed).
function genOrderNumber(): string {
	const hex = crypto.randomUUID().replace(/-/g, '').toUpperCase()
	return `ORD-${hex.slice(0, 8)}-${hex.slice(8, 12)}`
}

export const ordersService = {
	// ==================== CHECKOUT ====================
	async checkout(buyerId: string, input: Checkout) {
		const { shipping_address_id, payment_method, buyer_note, items } = input
		const buyer_id = buyerId

		// Merge duplicate (product_id + selected_options) lines into one
		// quantity per distinct variant — two lines for the same product with
		// different selected_options (e.g. two RAM choices) stay two separate
		// order items; the exact same product+variant submitted twice merges
		// into one. qtyByProduct separately collapses every line back down to
		// the unique set of product ids involved (for the lock/availability
		// check below — there's no per-product quantity to total anymore).
		const lineKey = (productId: number, selectedOptions?: Record<string, string>) =>
			`${productId}::${JSON.stringify(Object.entries(selectedOptions ?? {}).sort())}`

		const linesByKey = new Map<
			string,
			{
				product_id: number
				quantity: number
				selected_options: Record<string, string> | null
			}
		>()
		for (const item of items) {
			const key = lineKey(item.product_id, item.selected_options)
			const existing = linesByKey.get(key)
			if (existing) existing.quantity += item.quantity
			else
				linesByKey.set(key, {
					product_id: item.product_id,
					quantity: item.quantity,
					selected_options: item.selected_options ?? null,
				})
		}
		const lines = [...linesByKey.values()]

		const qtyByProduct = new Map<number, number>()
		for (const line of lines) {
			qtyByProduct.set(
				line.product_id,
				(qtyByProduct.get(line.product_id) ?? 0) + line.quantity,
			)
		}
		const productIds = [...qtyByProduct.keys()]

		// 1. Shipping address and buyer can be fetched outside the tx (read-only, non-critical).
		const address = await db.query.addresses.findFirst({
			where: and(
				eq(addresses.id, shipping_address_id),
				eq(addresses.user_id, buyer_id),
			),
			with: { province: { columns: { id: true, name: true } } },
		})
		if (!address) throw ApiError.notFound('Shipping address not found')

		const buyer = await db.query.users.findFirst({
			where: eq(users.id, buyer_id),
			columns: { name: true, phone: true },
		})
		if (!buyer) throw ApiError.notFound('Buyer not found')

		const shippingSnapshot = {
			name: buyer.name,
			phone: buyer.phone,
			province_id: address.province_id,
			province_name: address.province?.name ?? null,
			district: address.district,
			address_line: address.address_line,
			latitude: address.latitude,
			longitude: address.longitude,
		}

		const checkout_group_id = crypto.randomUUID()

		// 2. Atomic: single FOR UPDATE fetches all product data, verifies
		//    availability, creates orders, then marks every purchased product
		//    sold in one batch UPDATE. No stock/quantity involved — a listing
		//    here is classifieds-style (one of a kind), not retail inventory,
		//    so "available" is just is_active + not already sold, not a unit
		//    count to decrement.
		const created = await db.transaction(async (tx) => {
			const locked = await tx
				.select({
					id: products.id,
					store_id: products.store_id,
					title: products.title,
					price: products.price,
					currency: products.currency,
					is_active: products.is_active,
					listing_status: products.listing_status,
					images: products.images,
				})
				.from(products)
				.where(inArray(products.id, productIds))
				.for('update')

			if (locked.length !== productIds.length) {
				throw ApiError.badRequest('One or more products do not exist')
			}

			// Validate availability under lock.
			for (const row of locked) {
				if (!row.is_active || row.listing_status === 'sold') {
					throw ApiError.conflict(`Product "${row.title}" is no longer available`)
				}
			}

			const productById = new Map(locked.map((p) => [p.id, p]))

			// Group *lines* (not products) by store — a line's store comes from
			// its product, so two variant lines of the same product always land
			// in the same group together.
			const groups = new Map<
				number,
				Array<(typeof lines)[number] & { product: (typeof locked)[number] }>
			>()
			for (const line of lines) {
				const product = productById.get(line.product_id)
				if (!product) continue // unreachable — every product_id above came from these same lines
				const arr = groups.get(product.store_id) ?? []
				arr.push({ ...line, product })
				groups.set(product.store_id, arr)
			}

			const ordersOut: Array<{
				id: number
				order_number: string
				store_id: number
				currency: 'AFN' | 'USD' | 'PKR'
				subtotal: string
				total: string
				item_count: number
			}> = []

			for (const [store_id, storeLines] of groups) {
				const currency = storeLines[0]?.product.currency
				if (!currency) continue
				if (storeLines.some((l) => l.product.currency !== currency)) {
					throw ApiError.badRequest(
						'Mixed currencies within a single store order are not supported',
					)
				}

				let subtotalNum = 0
				let itemCount = 0
				const itemValues = storeLines.map((line) => {
					const lineTotal = round2(Number(line.product.price) * line.quantity)
					subtotalNum = round2(subtotalNum + lineTotal)
					itemCount += line.quantity
					return {
						product_id: line.product.id,
						title: line.product.title,
						image: firstImageUrl(line.product.images),
						unit_price: line.product.price,
						currency: line.product.currency,
						quantity: line.quantity,
						subtotal: lineTotal.toFixed(2),
						selected_options: line.selected_options,
					}
				})

				const totalNum = subtotalNum // + shipping - discount (0 for now)

				const [order] = await tx
					.insert(orders)
					.values({
						order_number: genOrderNumber(),
						checkout_group_id,
						buyer_id,
						store_id,
						payment_method: payment_method ?? 'cash_on_delivery',
						currency,
						subtotal: subtotalNum.toFixed(2),
						total: totalNum.toFixed(2),
						item_count: itemCount,
						shipping_address_id,
						shipping_address: shippingSnapshot,
						buyer_note,
					})
					.returning({
						id: orders.id,
						order_number: orders.order_number,
					})
				if (!order) throw ApiError.internal('Failed to create order')

				await tx
					.insert(orderItems)
					.values(itemValues.map((i) => ({ ...i, order_id: order.id })))

				ordersOut.push({
					id: order.id,
					order_number: order.order_number,
					store_id,
					currency,
					subtotal: subtotalNum.toFixed(2),
					total: totalNum.toFixed(2),
					item_count: itemCount,
				})
			}

			// Every purchased product is sold the moment it's bought — no
			// quantity to decrement toward zero first.
			await markProductsSold(tx, productIds)

			return ordersOut
		})

		// 5. Notify each store owner (fire-and-forget; never block the response).
		this.notifyStoreOwners(created, buyer_id, buyer.name).catch((err) =>
			console.error('[orders] failed to notify store owners:', err),
		)

		return { checkout_group_id, orders: created }
	},

	// ── Background: notify store owners of new orders ──
	async notifyStoreOwners(
		created: Array<{ id: number; store_id: number; order_number: string }>,
		buyerId: string,
		buyerName: string,
	) {
		const storeIds = created.map((o) => o.store_id)
		const owners = await db
			.select({ id: stores.id, owner_id: stores.owner_id, name: stores.name })
			.from(stores)
			.where(inArray(stores.id, storeIds))
		const ownerByStore = new Map(owners.map((o) => [o.id, o]))

		await Promise.all(
			created.map((o) => {
				const store = ownerByStore.get(o.store_id)
				if (!store || store.owner_id === buyerId) return undefined
				return notificationDispatchService.notifyUsers({
					type: 'new_order',
					recipients: [store.owner_id],
					actorId: buyerId,
					data: {
						title: 'New Order',
						order_id: o.id,
						order_number: o.order_number,
						buyer_name: buyerName,
					},
					// In-app only for v1 — no push category for new_order yet.
				})
			}),
		)
	},

	// ==================== READS ====================

	// ── Buyer order history (paginated, optional status filter) ──
	async getBuyerOrders(
		buyerId: string,
		opts: { status?: OrderStatus; limit: number; cursor?: CursorData },
	) {
		const conditions: SQL[] = [eq(orders.buyer_id, buyerId)]
		if (opts.status) conditions.push(eq(orders.status, opts.status))
		if (opts.cursor) {
			conditions.push(
				or(
					lt(orders.created_at, new Date(opts.cursor.created_at)),
					and(
						eq(orders.created_at, new Date(opts.cursor.created_at)),
						lt(orders.id, Number(opts.cursor.id)),
					),
				) as SQL,
			)
		}

		const rows = await db.query.orders.findMany({
			where: and(...conditions),
			with: {
				store: { columns: { id: true, name: true, logo_url: true } },
				items: true,
			},
			orderBy: [desc(orders.created_at), desc(orders.id)],
			limit: opts.limit + 1,
		})

		return paginate(rows, opts.limit)
	},

	// ── Seller order list (paginated, optional status filter) ──
	async getStoreOrders(
		storeId: number,
		opts: { status?: OrderStatus; limit: number; cursor?: CursorData },
	) {
		const conditions: SQL[] = [eq(orders.store_id, storeId)]
		if (opts.status) conditions.push(eq(orders.status, opts.status))
		if (opts.cursor) {
			conditions.push(
				or(
					lt(orders.created_at, new Date(opts.cursor.created_at)),
					and(
						eq(orders.created_at, new Date(opts.cursor.created_at)),
						lt(orders.id, Number(opts.cursor.id)),
					),
				) as SQL,
			)
		}

		const rows = await db.query.orders.findMany({
			where: and(...conditions),
			with: {
				buyer: { columns: { id: true, name: true, avatar_url: true } },
				items: true,
			},
			orderBy: [desc(orders.created_at), desc(orders.id)],
			limit: opts.limit + 1,
		})

		return paginate(rows, opts.limit)
	},

	// ── Store-owner dashboard: one bundle of all-time aggregates + today's
	//    revenue + a 7-day revenue series + the 4 most recent orders. Real SQL
	//    aggregates, not a scan over whatever order pages happen to be loaded. ──
	async getStoreDashboard(storeId: number) {
		const sevenDaysAgo = new Date()
		sevenDaysAgo.setHours(0, 0, 0, 0)
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

		const todayStart = new Date()
		todayStart.setHours(0, 0, 0, 0)

		const [statusRows, todayRevenueRows, seriesRows, recent] =
			await Promise.all([
				// All-time count + revenue per status, in one grouped query.
				db
					.select({
						status: orders.status,
						count: sql<number>`count(*)`,
						revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
					})
					.from(orders)
					.where(eq(orders.store_id, storeId))
					.groupBy(orders.status),

				db
					.select({ revenue: sql<string>`coalesce(sum(${orders.total}), 0)` })
					.from(orders)
					.where(
						and(
							eq(orders.store_id, storeId),
							sql`${orders.status} != 'cancelled'`,
							sql`${orders.created_at} >= ${todayStart}`,
						),
					),

				// Raw rows for the last 7 days; bucketed into a zero-filled series below.
				db
					.select({ created_at: orders.created_at, total: orders.total })
					.from(orders)
					.where(
						and(
							eq(orders.store_id, storeId),
							sql`${orders.status} != 'cancelled'`,
							sql`${orders.created_at} >= ${sevenDaysAgo}`,
						),
					),

				db.query.orders.findMany({
					where: eq(orders.store_id, storeId),
					with: {
						buyer: { columns: { id: true, name: true, avatar_url: true } },
						items: {
							with: {
								product: { columns: { id: true, title: true, images: true, category_id: true } },
							},
						},
					},
					orderBy: [desc(orders.created_at), desc(orders.id)],
					limit: 4,
				}),
			])

		const status_counts: Record<OrderStatus, number> = {
			pending: 0,
			confirmed: 0,
			processing: 0,
			shipped: 0,
			delivered: 0,
			cancelled: 0,
			returned: 0,
		}
		let orders_count = 0
		let revenue_total = 0
		for (const row of statusRows) {
			const status = row.status as OrderStatus
			status_counts[status] = Number(row.count)
			orders_count += Number(row.count)
			if (status !== 'cancelled')
				revenue_total = round2(revenue_total + Number(row.revenue))
		}

		// Zero-filled, oldest -> newest, keyed by local YYYY-MM-DD.
		const dayKey = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
		const byDay = new Map<string, number>()
		for (let i = 0; i < 7; i++) {
			const d = new Date(sevenDaysAgo)
			d.setDate(sevenDaysAgo.getDate() + i)
			byDay.set(dayKey(d), 0)
		}
		for (const row of seriesRows) {
			const key = dayKey(row.created_at)
			byDay.set(key, round2((byDay.get(key) ?? 0) + Number(row.total)))
		}
		const revenue_series = [...byDay.entries()].map(([date, revenue]) => ({
			date,
			revenue: revenue.toFixed(2),
		}))

		return {
			orders_count,
			revenue_total: revenue_total.toFixed(2),
			revenue_today: Number(todayRevenueRows[0]?.revenue ?? 0).toFixed(2),
			status_counts,
			revenue_series,
			recent_orders: recent,
		}
	},

	// ── Single order with full detail ──
	async getById(id: number) {
		return db.query.orders.findFirst({
			where: eq(orders.id, id),
			with: {
				store: {
					columns: {
						id: true,
						name: true,
						logo_url: true,
						owner_id: true,
						contact_phone: true,
					},
				},
				buyer: {
					columns: { id: true, name: true, phone: true, avatar_url: true },
				},
				items: {
					with: {
						product: { columns: { id: true, title: true, images: true, category_id: true } },
					},
				},
			},
		})
	},

	// ==================== MUTATIONS ====================

	// ── Seller updates order status (state machine) ──
	async updateStatus(orderId: number, actorId: string, newStatus: OrderStatus) {
		const order = await db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				store: { columns: { owner_id: true } },
				items: { columns: { product_id: true } },
			},
		})
		if (!order) throw ApiError.notFound('Order not found')

		// Authorize: only the store owner may change status.
		if (order.store.owner_id !== actorId) {
			throw ApiError.forbidden('You do not own this order')
		}

		const current = order.status as OrderStatus
		if (!ALLOWED_TRANSITIONS[current].includes(newStatus)) {
			throw ApiError.badRequest(
				`Cannot change status from "${current}" to "${newStatus}"`,
			)
		}

		const now = new Date()
		const stamp = STATUS_TIMESTAMP[newStatus]
		const patch: Record<string, unknown> = {
			status: newStatus,
			updated_at: now,
		}
		if (stamp) patch[stamp] = now

		if (newStatus === 'cancelled') {
			// Restock and update status atomically.
			await db.transaction(async (tx) => {
				await tx.update(orders).set(patch).where(eq(orders.id, orderId))
				await reactivateProducts(tx, order.items.map((i) => i.product_id))
			})
		} else {
			await db.update(orders).set(patch).where(eq(orders.id, orderId))
		}

		// Notify the buyer (fire-and-forget).
		notificationDispatchService
			.notifyUsers({
				type: 'order_status_changed',
				recipients: [order.buyer_id],
				actorId,
				data: {
					title: 'Order Update',
					order_id: orderId,
					order_number: order.order_number,
					status: newStatus,
				},
				push: {
					title: 'Order Update',
					body: `Order #${order.order_number} is now ${newStatus}`,
				},
			})
			.catch((err) =>
				console.error('[orders] failed to notify buyer of status change:', err),
			)

		return { id: orderId, status: newStatus }
	},

	// ── Buyer cancels their own order (only while pending/confirmed) ──
	async cancelByBuyer(orderId: number, buyerId: string, reason?: string) {
		const order = await db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				store: { columns: { owner_id: true } },
				items: { columns: { product_id: true } },
			},
		})
		if (!order) throw ApiError.notFound('Order not found')

		if (order.buyer_id !== buyerId) {
			throw ApiError.forbidden('You do not own this order')
		}

		const current = order.status as OrderStatus
		if (current !== 'pending' && current !== 'confirmed') {
			throw ApiError.badRequest(
				`Order can no longer be cancelled (status: "${current}")`,
			)
		}

		const now = new Date()
		await db.transaction(async (tx) => {
			await tx
				.update(orders)
				.set({
					status: 'cancelled',
					cancelled_at: now,
					cancel_reason: reason ?? null,
					updated_at: now,
				})
				.where(eq(orders.id, orderId))
			await reactivateProducts(tx, order.items.map((i) => i.product_id))
		})

		// Notify the store owner (fire-and-forget).
		if (order.store.owner_id !== buyerId) {
			notificationDispatchService
				.notifyUsers({
					type: 'order_status_changed',
					recipients: [order.store.owner_id],
					actorId: buyerId,
					data: {
						title: 'Order Cancelled',
						order_id: orderId,
						order_number: order.order_number,
						status: 'cancelled',
					},
					push: {
						title: 'Order Cancelled',
						body: `Order #${order.order_number} was cancelled`,
					},
				})
				.catch((err) =>
					console.error(
						'[orders] failed to notify owner of cancellation:',
						err,
					),
				)
		}

		return { id: orderId, status: 'cancelled' as const }
	},
}

// ==================== LOCAL UTILS ====================

// Shared cursor-pagination shaping (matches the rest of the codebase).
function paginate<T extends { created_at: Date; id: number }>(
	rows: T[],
	limit: number,
) {
	const hasMore = rows.length > limit
	const list = hasMore ? rows.slice(0, limit) : rows
	const last = list[list.length - 1]
	const nextCursor =
		hasMore && last
			? { created_at: last.created_at.toISOString(), id: last.id }
			: null
	return { orders: list, nextCursor, hasMore }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Marks every purchased product sold — no stock/quantity involved, see
// checkout's own comment on why. Called once per checkout, after every
// store group's orders have been created.
async function markProductsSold(tx: DbTx, productIds: number[]) {
	if (productIds.length === 0) return
	await tx
		.update(products)
		.set({ listing_status: 'sold' })
		.where(inArray(products.id, productIds))
}

// Reverts 'sold' back to 'active' for an order's products on cancellation —
// the inverse of markProductsSold. Only touches rows actually still 'sold'
// (a product the seller has since relisted some other way isn't clobbered
// back to 'active' just because an old order against it got cancelled).
async function reactivateProducts(tx: DbTx, productIds: Array<number | null>) {
	const ids = productIds.filter((id): id is number => id != null)
	if (ids.length === 0) return
	await tx
		.update(products)
		.set({ listing_status: 'active' })
		.where(and(inArray(products.id, ids), eq(products.listing_status, 'sold')))
}
