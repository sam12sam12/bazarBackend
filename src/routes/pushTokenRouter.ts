import { Hono } from 'hono'
import { pushTokenController } from '../controllers/pushTokenController.ts'
import { insertPushTokenSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Anonymous registration deliberately skips authMiddleware — a
// not-signed-in device still needs to receive broadcast notifications.
router.post(
	'/anonymous',
	validate(insertPushTokenSchema),
	pushTokenController.registerAnonymous,
)

router.post(
	'/',
	authMiddleware,
	validate(insertPushTokenSchema),
	pushTokenController.register,
)
router.delete('/', authMiddleware, pushTokenController.unregister)

export default router
