import type { Context } from 'hono'
import { addressService } from '../services/addressService.ts'
import { ApiError } from '../utils/ApiError'
import { parseCursor, parseId } from '../utils/pagination.ts'
import type { UserId } from '../utils/types.ts'

export const addressController = {
	async getByUser(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'
		if (userId !== currentUser.id && !isAdmin) throw ApiError.forbidden()

		const limit = 12

		const cursor = c.req.query('cursor')
		const parsedCursor = parseCursor(cursor)

		const result = await addressService.getByUserId(userId, limit, parsedCursor)
		return c.json({ success: true, data: result })
	},

	async getById(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const address = await addressService.getById(id)
		if (!address) throw ApiError.notFound('Address not found')
		if (address.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		return c.json({ success: true, data: address })
	},

	async create(c: Context) {
		const data = c.get('validated')
		const currentUser = c.get('user')
		const address = await addressService.create({
			...data,
			user_id: currentUser.id,
		})
		return c.json({ success: true, data: address }, 201)
	},

	async update(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const address = await addressService.getById(id)
		if (!address) throw ApiError.notFound('Address not found')
		if (address.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		const data = c.get('validated')
		const updated = await addressService.update(id, data)
		return c.json({ success: true, data: updated })
	},

	async delete(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const address = await addressService.getById(id)
		if (!address) throw ApiError.notFound('Address not found')
		if (address.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		await addressService.delete(id)
		return c.json({ success: true, message: 'Address deleted successfully' })
	},

	async setDefault(c: Context) {
		const id = parseId(c)
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		const address = await addressService.getById(id)
		if (!address) throw ApiError.notFound('Address not found')
		if (address.user_id !== currentUser.id && !isAdmin)
			throw ApiError.forbidden()

		const updated = await addressService.setDefault(
			id,
			currentUser.id as UserId,
		)
		if (!updated) throw ApiError.notFound('Address not found')

		return c.json({ success: true, data: updated })
	},
}
