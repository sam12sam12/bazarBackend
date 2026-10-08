import { eq } from 'drizzle-orm'
import { db } from '../db/db'
import { categories, categoryAttribute, provinces, reports } from '../db/schema'
import type {
	InsertCategory,
	InsertCategoryAttribute,
	InsertProvince,
	UpdateCategory,
	UpdateCategoryAttribute,
	UpdateProvince,
} from '../db/validation'
import type { CursorData } from '../utils/pagination'
import type { ReportStatus, ReportType } from '../utils/types'
import { contentVersionService } from './contentVersionService'
import { reportService } from './reportService'

export const dashboardService = {
	async createCategory(data: InsertCategory) {
		await db.transaction(async (tx) => {
			await tx.insert(categories).values(data)
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category created successfully'
	},

	async updateCategory(id: number, data: UpdateCategory) {
		await db.transaction(async (tx) => {
			await tx.update(categories).set(data).where(eq(categories.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category updated successfully'
	},

	async deleteCategory(id: number) {
		await db.transaction(async (tx) => {
			await tx
				.update(categories)
				.set({ is_active: false })
				.where(eq(categories.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category deleted successfully'
	},

	async createCategoryAttribute(data: InsertCategoryAttribute) {
		await db.transaction(async (tx) => {
			await tx.insert(categoryAttribute).values(data)
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category attribute created successfully'
	},

	async updateCategoryAttribute(id: number, data: UpdateCategoryAttribute) {
		await db.transaction(async (tx) => {
			await tx
				.update(categoryAttribute)
				.set(data)
				.where(eq(categoryAttribute.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category attribute updated successfully'
	},

	async deleteCategoryAttribute(id: number) {
		await db.transaction(async (tx) => {
			await tx.delete(categoryAttribute).where(eq(categoryAttribute.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Category attribute deleted successfully'
	},

	async createProvince(data: InsertProvince) {
		await db.transaction(async (tx) => {
			await tx.insert(provinces).values(data)
			await contentVersionService.bumpVersion(tx)
		})
		return 'Province created successfully'
	},

	async updateProvince(id: number, data: UpdateProvince) {
		await db.transaction(async (tx) => {
			await tx.update(provinces).set(data).where(eq(provinces.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Province updated successfully'
	},

	async deleteProvince(id: number) {
		await db.transaction(async (tx) => {
			await tx.delete(provinces).where(eq(provinces.id, id))
			await contentVersionService.bumpVersion(tx)
		})
		return 'Province deleted successfully'
	},

	async getAllReports(limit: number, cursor?: CursorData, type?: ReportType) {
		return reportService.getAdminAll(limit, cursor, type)
	},

	async getReportsByUser(userId: string, limit: number, cursor?: CursorData) {
		return reportService.getAdminByUser(userId, limit, cursor)
	},

	async updateReportStatus(reportId: number, status: ReportStatus) {
		await db.update(reports).set({ status }).where(eq(reports.id, reportId))
		return 'Report status updated successfully'
	},

	async deleteReport(reportId: number) {
		await db.delete(reports).where(eq(reports.id, reportId))
		return 'Report deleted successfully'
	},
}
