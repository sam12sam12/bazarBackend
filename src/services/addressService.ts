import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { addresses } from '../db/schema'
import type { InsertAddress, UpdateAddress } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import type { UserId } from '../utils/types'

export const addressService = {
	async getByUserId(userId: UserId, limit: number, cursor?: CursorData) {
		const baseFilter = eq(addresses.user_id, userId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(addresses, cursor))
			: baseFilter

		const results = await db.query.addresses.findMany({
			where: whereCondition,
			with: {
				province: {
					columns: { name: true, code: true },
				},
			},
			orderBy: [desc(addresses.created_at), desc(addresses.id)],
			limit: limit + 1,
		})

		const {
			list: addressList,
			nextCursor,
			hasMore,
		} = paginateResults(results, limit)
		return { addresses: addressList, nextCursor, hasMore }
	},

	async getById(id: number) {
		return db.query.addresses.findFirst({
			where: eq(addresses.id, id),
			with: {
				province: {
					columns: { name: true, code: true },
				},
			},
		})
	},

	// Returns the fully hydrated row (same shape as getById) instead of a
	// bare boolean — the frontend writes this straight into its caches
	// instead of refetching.
	async create(data: InsertAddress) {
		// Count existing addresses for the user to decide if this should be default
		const existing = await db.query.addresses.findMany({
			where: eq(addresses.user_id, data.user_id),
			columns: { id: true },
		})

		if (existing.length === 0) {
			data.is_default = true
		} else if (data.is_default) {
			await addressHelpingFunctions.unsetOtherDefaults(data.user_id)
		}

		const [created] = await db
			.insert(addresses)
			.values(data)
			.returning({ id: addresses.id })
		return created ? this.getById(created.id) : undefined
	},

	// Same reasoning as create.
	async update(id: number, data: UpdateAddress) {
		const current = await this.getById(id)
		if (!current) return null

		if (data.is_default && !current.is_default) {
			await addressHelpingFunctions.unsetOtherDefaults(current.user_id)
		}

		await db.update(addresses).set(data).where(eq(addresses.id, id))
		return this.getById(id)
	},

	async delete(id: number) {
		await db.delete(addresses).where(eq(addresses.id, id))
		return true
	},

	// Same reasoning as create/update.
	async setDefault(addressId: number, userId: UserId) {
		await addressHelpingFunctions.unsetOtherDefaults(userId)

		await db
			.update(addresses)
			.set({ is_default: true })
			.where(eq(addresses.id, addressId))

		return this.getById(addressId)
	},
}

// ─── HELPING FUNCTIONS ────────────────────────────────────────────────────────
const addressHelpingFunctions = {
	async unsetOtherDefaults(userId: UserId) {
		await db
			.update(addresses)
			.set({ is_default: false })
			.where(eq(addresses.user_id, userId))
	},
}
