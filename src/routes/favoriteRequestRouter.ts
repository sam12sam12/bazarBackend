import { Hono } from 'hono'
import { favoriteRequestController } from '../controllers/favoriteRequestController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Saved requests are private to the signed-in user.
router.use('*', authMiddleware)

router.get('/ids', favoriteRequestController.getIds)
router.get('/mine', favoriteRequestController.getMine)
router.post('/:id/toggle', favoriteRequestController.toggle)

export default router
