import { Hono } from 'hono'
import { userController } from '../controllers/userController.ts'
import { insertUserSchema, updateUserSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// router.use('*', authMiddleware)

router.get('/me', authMiddleware, userController.getMe)
router.get('/', userController.getAll)
router.get('/:userId', userController.getByUserId)
router.post('/', validate(insertUserSchema), userController.create)
router.patch('/:userId', validate(updateUserSchema), userController.update)
router.delete('/:userId', userController.delete)

export default router
