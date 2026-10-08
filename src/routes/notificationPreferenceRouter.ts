import { Hono } from 'hono'
import { notificationPreferenceController } from '../controllers/notificationPreferenceController.ts'
import { updateNotificationPreferenceSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

router.use('*', authMiddleware)

router.get('/', notificationPreferenceController.get)
router.patch(
	'/',
	validate(updateNotificationPreferenceSchema),
	notificationPreferenceController.update,
)

export default router
