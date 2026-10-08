import { Hono } from 'hono'
import { storeViewController } from '../controllers/storeViewController.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'

const router = new Hono()

// Recently-viewed stores are private to the signed-in user.
router.use('*', authMiddleware)

router.get('/recent', storeViewController.getRecent)

export default router
