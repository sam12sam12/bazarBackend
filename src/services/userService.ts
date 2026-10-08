import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { users } from '../db/schema'
import type { InsertUser, UpdateUser } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import { storage } from '../utils/storage/instance'

export const userService = {
	async getAll(limit: number, cursor?: CursorData) {
		const activeFilter = eq(users.is_active, true)
		const whereCondition = cursor
			? and(activeFilter, buildCursorFilter(users, cursor, String))
			: activeFilter

		const results = await db.query.users.findMany({
			where: whereCondition,
			columns: {
				id: true,
				name: true,
				avatar_url: true,
				role: true,
				is_active: true,
				created_at: true,
			},
			with: {
				province: {
					columns: { name: true },
				},
			},
			orderBy: [desc(users.created_at), desc(users.id)],
			limit: limit + 1,
		})

		const {
			list: usersList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { users: usersList, nextCursor, hasMore }
	},

	async getMe(userId: string) {
		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: {
				id: true,
				name: true,
				email: true,
				phone: true,
				avatar_url: true,
				role: true,
				is_active: true,
				email_verified: true,
				last_login: true,
				created_at: true,
			},
			with: {
				province: {
					columns: { name: true },
				},
			},
		})

		return user
	},

	async getByUserId(userId: string) {
		const whereCondition = and(eq(users.id, userId), eq(users.is_active, true))

		const user = await db.query.users.findFirst({
			where: whereCondition,
			columns: {
				id: true,
				name: true,
				avatar_url: true,
				role: true,
				is_active: true,
				created_at: true,
			},
			with: {
				province: {
					columns: { name: true },
				},
			},
		})

		return user
	},

	async create(data: InsertUser) {
		await db.insert(users).values(data)
		return 'User created successfully'
	},

	async update(userId: string, data: UpdateUser) {
		const previous =
			data.avatar_url !== undefined
				? await db.query.users.findFirst({
						where: eq(users.id, userId),
						columns: { avatar_url: true },
					})
				: undefined

		await storage.validateNewImage(data.avatar_url, previous?.avatar_url)

		const [updated] = await db
			.update(users)
			.set(data)
			.where(eq(users.id, userId))
			.returning({ id: users.id })
		if (!updated) return null

		await storage.reconcileImage(previous?.avatar_url, data.avatar_url)
		return updated
	},

	async delete(userId: string) {
		await db.update(users).set({ is_active: false }).where(eq(users.id, userId))
		return 'User deactivated successfully'
	},

	// Recipient ids for an admin broadcast — 'all' is every active user
	// regardless of role, 'buyers'/'sellers' narrow to that role only.
	async getIdsBySegment(
		segment: 'all' | 'buyers' | 'sellers',
	): Promise<string[]> {
		const whereCondition =
			segment === 'buyers'
				? and(eq(users.is_active, true), eq(users.role, 'buyer'))
				: segment === 'sellers'
					? and(eq(users.is_active, true), eq(users.role, 'seller'))
					: eq(users.is_active, true)

		const rows = await db
			.select({ id: users.id })
			.from(users)
			.where(whereCondition)
		return rows.map((r) => r.id)
	},
}
