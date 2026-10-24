import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/db'
import { reports } from '../db/schema'
import type { InsertReport } from '../db/validation'
import {
	buildCursorFilter,
	type CursorData,
	paginateResults,
} from '../utils/pagination'
import type { ReportType } from '../utils/types'
import { notificationDispatchService } from './notificationDispatchService'
import { userService } from './userService'

export const reportService = {
	async createReport(userId: string, data: InsertReport, reporterName: string) {
		await db.insert(reports).values({ ...data, user_id: userId })

		// Notify every admin in the background — never blocks the response.
		const adminIds = await userService.getAdminIds()
		if (adminIds.length > 0) {
			const body = `${reporterName} reported a ${data.type} for ${data.reason}`
			notificationDispatchService
				.notifyUsers({
					type: 'report_received',
					recipients: adminIds,
					actorId: userId,
					data: {
						title: 'New Report',
						body,
						report_type: data.type,
						reason: data.reason,
					},
					push: { title: 'New Report', body },
				})
				.catch((err) =>
					console.error(
						'[notification] failed to notify admins of report:',
						err,
					),
				)
		}

		return 'Report submitted successfully'
	},

	async getAllReports(limit: number, cursor?: CursorData) {
		const whereCondition = cursor
			? buildCursorFilter(reports, cursor)
			: undefined

		const results = await db.query.reports.findMany({
			where: whereCondition,
			orderBy: [desc(reports.created_at), desc(reports.id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		return { reports: list, nextCursor, hasMore }
	},

	async getUserReports(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(reports.user_id, userId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(reports, cursor))
			: baseFilter

		const results = await db.query.reports.findMany({
			where: whereCondition,
			orderBy: [desc(reports.created_at), desc(reports.id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		return { reports: list, nextCursor, hasMore }
	},

	// ── Admin queries — include relations and optional type filter ──

	async getAdminAll(limit: number, cursor?: CursorData, type?: ReportType) {
		const typeFilter = type ? eq(reports.type, type) : undefined
		const cursorFilter = cursor ? buildCursorFilter(reports, cursor) : undefined
		const whereCondition = and(typeFilter, cursorFilter)

		const results = await db.query.reports.findMany({
			where: whereCondition,
			with: {
				user: { columns: { id: true, name: true, avatar_url: true } },
				product: { columns: { id: true, title: true } },
				store: { columns: { id: true, name: true } },
				request: { columns: { id: true, title: true } },
				reportedUser: { columns: { id: true, name: true, avatar_url: true } },
			},
			orderBy: [desc(reports.created_at), desc(reports.id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		return { reports: list, nextCursor, hasMore }
	},

	async getAdminByUser(userId: string, limit: number, cursor?: CursorData) {
		const baseFilter = eq(reports.user_id, userId)
		const whereCondition = cursor
			? and(baseFilter, buildCursorFilter(reports, cursor))
			: baseFilter

		const results = await db.query.reports.findMany({
			where: whereCondition,
			with: {
				product: { columns: { id: true, title: true } },
				store: { columns: { id: true, name: true } },
				request: { columns: { id: true, title: true } },
				reportedUser: { columns: { id: true, name: true, avatar_url: true } },
			},
			orderBy: [desc(reports.created_at), desc(reports.id)],
			limit: limit + 1,
		})

		const { list, nextCursor, hasMore } = paginateResults(results, limit)
		return { reports: list, nextCursor, hasMore }
	},
}
