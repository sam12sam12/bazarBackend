import type { Context } from 'hono'
import { chatService } from '../services/chatService.ts'
import { parseCursor, parseId, parseUuid } from '../utils/pagination.ts'

export const chatController = {
	async listConversations(c: Context) {
		const user = c.get('user')
		const limit = 20
		const cursor = parseCursor(c.req.query('cursor'))

		const { conversations, nextCursor, hasMore } =
			await chatService.listConversations(user.id, limit, cursor)
		return c.json({
			success: true,
			data: { conversations, nextCursor, hasMore },
		})
	},

	async getMessages(c: Context) {
		const user = c.get('user')
		const conversationId = parseId(c)
		const limit = 30
		const cursor = parseCursor(c.req.query('cursor'))

		const result = await chatService.getMessages(
			conversationId,
			user.id,
			limit,
			cursor,
		)
		return c.json({ success: true, data: result })
	},

	async getMessagesWithUser(c: Context) {
		const user = c.get('user')
		const otherUserId = parseUuid(c, 'userId')
		const limit = 30
		const cursor = parseCursor(c.req.query('cursor'))

		const result = await chatService.getMessagesWithUser(
			otherUserId,
			user.id,
			limit,
			cursor,
		)
		return c.json({ success: true, data: result })
	},

	async markRead(c: Context) {
		const user = c.get('user')
		const conversationId = parseId(c)

		const readAt = await chatService.markRead(conversationId, user.id)
		return c.json({ success: true, data: { readAt } })
	},
}
