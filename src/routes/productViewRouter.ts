import { Hono } from 'hono'
import { productViewController } from '../controllers/productViewController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Recently-viewed products are private to the signed-in user.
router.use('*', authMiddleware)

router.get('/recent', productViewController.getRecent)

export default router
