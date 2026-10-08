import { Hono } from 'hono'
import { favoriteStoreController } from '../controllers/favoriteStoreController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Saved stores are private to the signed-in user.
router.use('*', authMiddleware)

router.get('/ids', favoriteStoreController.getIds)
router.get('/mine', favoriteStoreController.getMine)
router.post('/:id/toggle', favoriteStoreController.toggle)

export default router
