import { Hono } from 'hono'
import { notificationController } from '../controllers/notificationController.ts'
import { insertNotificationSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Notifications are private to their recipient.
router.use('*', authMiddleware)

router.get('/user/:userId', notificationController.getByUser)
router.get('/user/:userId/unread-count', notificationController.getUnreadCount)
router.post(
	'/',
	validate(insertNotificationSchema),
	notificationController.create,
)
router.patch('/:id/read', notificationController.markAsRead)
router.patch('/user/:userId/read-all', notificationController.markAllAsRead)
router.delete('/:id', notificationController.delete)

export default router
