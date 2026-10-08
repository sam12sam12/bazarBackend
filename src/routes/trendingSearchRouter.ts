import { Hono } from 'hono'
import { trendingSearchController } from '../controllers/trendingSearchController'

const router = new Hono()

router.get('/', trendingSearchController.getAll)

export default router
