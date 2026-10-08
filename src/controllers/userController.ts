import type { Context } from 'hono'
import { userService } from '../services/userService.ts'
import { ApiError } from '../utils/ApiError'
import { parseCursor } from '../utils/pagination.ts'
import type { UserId } from '../utils/types.ts'

export const userController = {
	async getMe(c: Context) {
		const sessionUser = c.get('user')
		const user = await userService.getMe(sessionUser.id)
		if (!user) throw ApiError.notFound('User not found')
		return c.json({ success: true, data: user })
	},

	async getAll(c: Context) {
		const limit = 12
		const cursor = c.req.query('cursor')
		const parsedCursor = parseCursor(cursor)

		const result = await userService.getAll(limit, parsedCursor)
		return c.json({ success: true, data: result })
	},

	async getByUserId(c: Context) {
		const userId = c.req.param('userId') as UserId
		const user = await userService.getByUserId(userId)
		if (!user) throw ApiError.notFound('User not found')
		return c.json({ success: true, data: user })
	},

	async create(c: Context) {
		const data = c.get('validated')
		const user = await userService.create(data)
		return c.json({ success: true, data: user }, 201)
	},

	async update(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		if (currentUser.id !== userId && !isAdmin) throw ApiError.forbidden()

		const data = c.get('validated')
		const user = await userService.update(userId, data)
		if (!user) throw ApiError.notFound('User not found')
		return c.json({ success: true, data: user })
	},

	async delete(c: Context) {
		const userId = c.req.param('userId') as UserId
		const currentUser = c.get('user')
		const isAdmin = (currentUser as { role?: string }).role === 'admin'

		if (currentUser.id !== userId && !isAdmin) throw ApiError.forbidden()

		await userService.delete(userId)
		return c.json({ success: true, message: 'User deleted successfully' })
	},
}
