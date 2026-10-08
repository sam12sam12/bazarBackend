import { Hono } from 'hono'
import { favoriteProductController } from '../controllers/favoriteProductController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Saved products are private to the signed-in user.
router.use('*', authMiddleware)

router.get('/ids', favoriteProductController.getIds)
router.get('/mine', favoriteProductController.getMine)
router.post('/:id/toggle', favoriteProductController.toggle)

export default router
