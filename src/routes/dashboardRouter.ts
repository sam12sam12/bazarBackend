import { Hono } from 'hono'
import { categoryController } from '../controllers/categoryController.ts'
import { dashboardController } from '../controllers/dashboardController.ts'
import { provinceController } from '../controllers/provinceController.ts'
import {
	adminBroadcastSchema,
	insertCategoryAttributeSchema,
	insertCategorySchema,
	insertProvinceSchema,
	updateCategoryAttributeSchema,
	updateCategorySchema,
	updateProvinceSchema,
	updateReportSchema,
} from '../db/validation.ts'
import {
	adminMiddleware,
	authMiddleware,
} from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Admin-only surface — every route, reads included.
router.use('*', authMiddleware, adminMiddleware)

// The mobile app gets categories/attributes/provinces from `/api/v1/meta` —
// these reads exist only for the admin dashboard, which fetches the whole
// tree/list once and derives everything else (single category, children,
// attributes) client-side, same as the mobile app does.
router.get('/categories/tree', categoryController.getTree)
router.get('/provinces', provinceController.getAll)

router.post(
	'/categories',
	validate(insertCategorySchema),
	dashboardController.createCategory,
)

router.patch(
	'/categories/:id',
	validate(updateCategorySchema),
	dashboardController.updateCategory,
)

router.delete('/categories/:id', dashboardController.deleteCategory)

router.post(
	'/categories/attributes',
	validate(insertCategoryAttributeSchema),
	dashboardController.createCategoryAttribute,
)

router.patch(
	'/categories/attributes/:id',
	validate(updateCategoryAttributeSchema),
	dashboardController.updateCategoryAttribute,
)

router.delete(
	'/categories/attributes/:id',
	dashboardController.deleteCategoryAttribute,
)

router.post(
	'/provinces',
	validate(insertProvinceSchema),
	dashboardController.createProvince,
)

router.patch(
	'/provinces/:id',
	validate(updateProvinceSchema),
	dashboardController.updateProvince,
)

router.delete('/provinces/:id', dashboardController.deleteProvince)

router.get('/reports', dashboardController.getAllReports)
router.get('/reports/user/:userId', dashboardController.getUserReports)
router.patch(
	'/reports/:id/status',
	validate(updateReportSchema),
	dashboardController.updateReportStatus,
)

router.delete('/reports/:id', dashboardController.deleteReport)

router.post(
	'/broadcast',
	validate(adminBroadcastSchema),
	dashboardController.sendBroadcast,
)
router.get('/push-health', dashboardController.getPushHealth)

export default router
