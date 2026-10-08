import type { Context } from 'hono'
import { orderStatusValues } from '../db/validation.ts'
import { ordersService } from '../services/ordersService.ts'
import { storeService } from '../services/storeService.ts'
import { ApiError } from '../utils/ApiError.ts'
import { parseCursor, parseId } from '../utils/pagination.ts'

type OrderStatus = (typeof orderStatusValues)[number]

// Mirrors storeController's assertStoreOwner — store owners and admins only.
async function assertStoreOwner(
	storeId: number,
	currentUser: { id: string; role?: string },
) {
	const store = await storeService.getById(storeId)
	if (!store) throw ApiError.notFound('Store not found')
	if (store.owner_id !== currentUser.id && currentUser.role !== 'admin') {
		throw ApiError.forbidden()
	}
	return store
}

// Only accept a status the enum actually contains; anything else is treated
// as "no filter" rather than reaching the query as garbage.
function parseOrderStatus(raw: string | undefined): OrderStatus | undefined {
	return raw && (orderStatusValues as readonly string[]).includes(raw)
		? (raw as OrderStatus)
		: undefined
}

export const ordersController = {
	// POST /checkout
	async checkout(c: Context) {
		const data = c.get('validated')
		const user = c.get('user')
		const result = await ordersService.checkout(user.id, data)
		return c.json({ success: true, data: result }, 201)
	},

	// GET /?status=
	async getBuyerOrders(c: Context) {
		const buyerId = c.get('user').id
		const result = await ordersService.getBuyerOrders(buyerId, {
			status: parseOrderStatus(c.req.query('status')),
			limit: 12,
			cursor: parseCursor(c.req.query('cursor')),
		})
		return c.json({ success: true, data: result })
	},

	// GET /store/:storeId?status=
	async getStoreOrders(c: Context) {
		const storeId = parseId(c, 'storeId')
		await assertStoreOwner(storeId, c.get('user'))

		const result = await ordersService.getStoreOrders(storeId, {
			status: parseOrderStatus(c.req.query('status')),
			limit: 12,
			cursor: parseCursor(c.req.query('cursor')),
		})
		return c.json({ success: true, data: result })
	},

	// GET /:id
	async getById(c: Context) {
		const id = parseId(c)
		const user = c.get('user')
		const order = await ordersService.getById(id)
		if (!order) throw ApiError.notFound('Order not found')

		const isBuyer = order.buyer_id === user.id
		const isStoreOwner = order.store?.owner_id === user.id
		if (!isBuyer && !isStoreOwner && user.role !== 'admin') {
			throw ApiError.forbidden()
		}
		return c.json({ success: true, data: order })
	},

	// PATCH /:id/status
	async updateStatus(c: Context) {
		const id = parseId(c)
		const { status } = c.get('validated')
		const actorId = c.get('user').id
		const result = await ordersService.updateStatus(id, actorId, status)
		return c.json({ success: true, data: result })
	},

	// PATCH /:id/cancel
	async cancel(c: Context) {
		const id = parseId(c)
		const { cancel_reason } = c.get('validated')
		const buyerId = c.get('user').id
		const result = await ordersService.cancelByBuyer(id, buyerId, cancel_reason)
		return c.json({ success: true, data: result })
	},
}
