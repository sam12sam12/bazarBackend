import { and, desc, eq, lt, or, type SQL, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { addresses, orders, products, stores, users } from '../db/schema'
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
	| 'completed'
	| 'cancelled'
	| 'returned'

// Allowed status transitions (state machine). Empty array = terminal.
// `delivered` means the seller/courier says it arrived; `completed` is the
// buyer's own confirmation of receipt (see updateStatus's authorization
// branch below) — kept strictly terminal, not reachable from/to `returned`.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pending: ['confirmed', 'cancelled'],
	confirmed: ['processing', 'cancelled'],
	processing: ['shipped', 'cancelled'],
	shipped: ['delivered'],
	delivered: ['completed', 'returned'],
	completed: [],
	cancelled: [],
	returned: [],
}

// Maps a destination status to the timestamp column it stamps.
const STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
	confirmed: 'confirmed_at',
	shipped: 'shipped_at',
	delivered: 'delivered_at',
	completed: 'completed_at',
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
	// One order = exactly one product — there's no cart, so checkout never
	// needs to group lines by store or dedupe variants; it's always exactly
	// one row.
	async checkout(buyerId: string, input: Checkout) {
		const {
			shipping_address_id,
			payment_method,
			buyer_note,
			product_id,
			quantity,
			selected_options,
		} = input
		const buyer_id = buyerId

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

		// 2. Atomic: lock the product row, verify availability, create the
		//    order. No stock/quantity tracking — a listing stays orderable
		//    indefinitely; "available" is just whether the seller still has
		//    it active.
		const order = await db.transaction(async (tx) => {
			const [product] = await tx
				.select({
					id: products.id,
					store_id: products.store_id,
					title: products.title,
					price: products.price,
					currency: products.currency,
					is_active: products.is_active,
					images: products.images,
					province_id: products.province_id,
					delivery_available: products.delivery_available,
					intra_city_fee: products.intra_city_fee,
					inter_province_fee: products.inter_province_fee,
				})
				.from(products)
				.where(eq(products.id, product_id))
				.for('update')

			if (!product) throw ApiError.badRequest('Product does not exist')
			if (!product.is_active) {
				throw ApiError.conflict(
					`Product "${product.title}" is no longer available`,
				)
			}

			const subtotalNum = round2(Number(product.price) * quantity)

			// Compares the product's own province (not the store's — a store
			// can list items located in a different province from its own) to
			// the shipping address's province. `0` when delivery isn't offered
			// or the matching fee column is null.
			const isIntraCity = product.province_id === address.province_id
			const shippingFeeNum = product.delivery_available
				? Number(
						(isIntraCity
							? product.intra_city_fee
							: product.inter_province_fee) ?? 0,
					)
				: 0
			const totalNum = round2(subtotalNum + shippingFeeNum)

			const [created] = await tx
				.insert(orders)
				.values({
					order_number: genOrderNumber(),
					buyer_id,
					store_id: product.store_id,
					product_id: product.id,
					title: product.title,
					image: firstImageUrl(product.images),
					unit_price: product.price,
					quantity,
					selected_options: selected_options ?? null,
					payment_method: payment_method ?? 'cash_on_delivery',
					currency: product.currency,
					subtotal: subtotalNum.toFixed(2),
					shipping_fee: shippingFeeNum.toFixed(2),
					total: totalNum.toFixed(2),
					shipping_address_id,
					shipping_address: shippingSnapshot,
					buyer_note,
				})
				.returning({
					id: orders.id,
					order_number: orders.order_number,
					store_id: orders.store_id,
					currency: orders.currency,
					subtotal: orders.subtotal,
					shipping_fee: orders.shipping_fee,
					total: orders.total,
					quantity: orders.quantity,
				})
			if (!created) throw ApiError.internal('Failed to create order')
			return created
		})

		// 3. Notify the store owner and the buyer themselves (fire-and-forget;
		//    never block the response).
		this.notifyStoreOwner(order, buyer_id, buyer.name).catch((err) =>
			console.error('[orders] failed to notify store owner:', err),
		)
		this.notifyBuyer(order, buyer_id).catch((err) =>
			console.error('[orders] failed to notify buyer:', err),
		)

		return order
	},

	// ── Background: notify the store owner of a new order ──
	async notifyStoreOwner(
		order: { id: number; store_id: number; order_number: string },
		buyerId: string,
		buyerName: string,
	) {
		const store = await db.query.stores.findFirst({
			where: eq(stores.id, order.store_id),
			columns: { owner_id: true },
		})
		if (!store || store.owner_id === buyerId) return

		const body = `${buyerName} placed an order #${order.order_number}`
		await notificationDispatchService.notifyUsers({
			type: 'new_order',
			recipients: [store.owner_id],
			actorId: buyerId,
			data: {
				title: 'New Order',
				body,
				order_role: 'seller',
				order_id: order.id,
				order_number: order.order_number,
				buyer_name: buyerName,
			},
			push: { title: 'New Order', body },
		})
	},

	// ── Background: confirm to the buyer their order went through. In-app
	//    only, same as the store owner's own new_order notification above. ──
	async notifyBuyer(
		order: { id: number; order_number: string },
		buyerId: string,
	) {
		const body = `Order #${order.order_number} has been placed`
		await notificationDispatchService.notifyUsers({
			type: 'new_order',
			recipients: [buyerId],
			actorId: buyerId,
			data: {
				title: 'Order Placed',
				body,
				order_role: 'buyer',
				order_id: order.id,
				order_number: order.order_number,
			},
		})
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
				product: {
					columns: { id: true, title: true, images: true, category_id: true },
				},
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
				product: {
					columns: { id: true, title: true, images: true, category_id: true },
				},
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
						product: {
							columns: {
								id: true,
								title: true,
								images: true,
								category_id: true,
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
			completed: 0,
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
				product: {
					columns: { id: true, title: true, images: true, category_id: true },
				},
			},
		})
	},

	// ==================== MUTATIONS ====================

	// ── Seller updates order status (state machine) — except `completed`,
	// which is the buyer's own "mark as received" confirmation. ──
	async updateStatus(orderId: number, actorId: string, newStatus: OrderStatus) {
		const order = await db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				store: { columns: { owner_id: true } },
			},
		})
		if (!order) throw ApiError.notFound('Order not found')

		// Authorize: every transition is seller-only except the one that isn't
		// theirs to make — only the buyer can confirm they received the order.
		if (newStatus === 'completed') {
			if (order.buyer_id !== actorId) {
				throw ApiError.forbidden(
					'Only the buyer can mark this order as received',
				)
			}
		} else if (order.store.owner_id !== actorId) {
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

		await db.update(orders).set(patch).where(eq(orders.id, orderId))

		// Notify the buyer (fire-and-forget).
		notificationDispatchService
			.notifyUsers({
				type: 'order_status_changed',
				recipients: [order.buyer_id],
				actorId,
				data: {
					title: 'Order Update',
					body: `Order #${order.order_number} is now ${newStatus}`,
					order_role: 'buyer',
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
		await db
			.update(orders)
			.set({
				status: 'cancelled',
				cancelled_at: now,
				cancel_reason: reason ?? null,
				updated_at: now,
			})
			.where(eq(orders.id, orderId))

		// Notify the store owner (fire-and-forget).
		if (order.store.owner_id !== buyerId) {
			notificationDispatchService
				.notifyUsers({
					type: 'order_status_changed',
					recipients: [order.store.owner_id],
					actorId: buyerId,
					data: {
						title: 'Order Cancelled',
						body: `Order #${order.order_number} was cancelled`,
						order_role: 'seller',
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
