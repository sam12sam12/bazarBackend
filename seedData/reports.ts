import { faker } from '@faker-js/faker'
import { db } from '../src/db/db'
import { reports } from '../src/db/schema'
import { getProductIds, getStoreIds, getUserIds } from './index'

type ReportInsert = typeof reports.$inferInsert

const REPORT_REASONS = [
	'spam',
	'inappropriate',
	'fraud',
	'illegal',
	'other',
] as const
const REPORT_STATUSES = ['pending', 'resolved', 'dismissed'] as const

export async function generateReportsFakerData(count = 30) {
	const userIds = await getUserIds()
	const productIds = await getProductIds()
	const storeIds = await getStoreIds()

	if (userIds.length === 0) {
		console.warn('⚠️  No users found — skipping reports seed.')
		return
	}
	if (productIds.length === 0 && storeIds.length === 0) {
		console.warn('⚠️  No products or stores found — skipping reports seed.')
		return
	}

	// Build the pool of reportable targets (product or store, not both)
	type ReportTarget =
		| { type: 'product'; product_id: number; store_id: null }
		| { type: 'store'; store_id: number; product_id: null }

	const targets: ReportTarget[] = [
		...productIds.map((id) => ({
			type: 'product' as const,
			product_id: id,
			store_id: null as null,
		})),
		...storeIds.map((id) => ({
			type: 'store' as const,
			store_id: id,
			product_id: null as null,
		})),
	]

	// Load existing reports to avoid duplicating (user_id + target) pairs
	const existingReports = await db
		.select({
			user_id: reports.user_id,
			product_id: reports.product_id,
			store_id: reports.store_id,
		})
		.from(reports)

	const seenPairs = new Set<string>()
	for (const r of existingReports) {
		const key = r.product_id
			? `user:${r.user_id}-product:${r.product_id}`
			: `user:${r.user_id}-store:${r.store_id}`
		seenPairs.add(key)
	}

	const reportsFakerData: ReportInsert[] = []
	let attempts = 0
	const maxAttempts = count * 15

	while (reportsFakerData.length < count && attempts < maxAttempts) {
		attempts++

		const user_id = faker.helpers.arrayElement(userIds)
		const target = faker.helpers.arrayElement(targets)

		const pairKey =
			target.type === 'product'
				? `user:${user_id}-product:${target.product_id}`
				: `user:${user_id}-store:${target.store_id}`

		if (seenPairs.has(pairKey)) continue
		seenPairs.add(pairKey)

		const reason = faker.helpers.arrayElement(REPORT_REASONS)
		const status = faker.helpers.arrayElement(REPORT_STATUSES)

		// Respect the DB check constraint:
		// type='product'  → product_id set, store_id NULL
		// type='store'    → store_id set,   product_id NULL
		reportsFakerData.push({
			user_id,
			type: target.type,
			product_id: target.type === 'product' ? target.product_id : null,
			store_id: target.type === 'store' ? target.store_id : null,
			reason,
			description: faker.datatype.boolean({ probability: 0.7 })
				? faker.lorem.sentence()
				: null,
			status,
		} as ReportInsert)
	}

	await db.insert(reports).values(reportsFakerData)
}
