import { Hono } from 'hono'
import { reportController } from '../controllers/reportController.ts'
import { insertReportSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// router.use('*', authMiddleware)

router.get('/', reportController.getAllReports)
router.get('/my', authMiddleware, reportController.getUserReports)
router.post(
	'/',
	authMiddleware,
	validate(insertReportSchema),
	reportController.createReport,
)

export default router
