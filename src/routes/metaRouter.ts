import { Hono } from 'hono'
import { metaController } from '../controllers/metaController.ts'

const router = new Hono()

router.get('/', metaController.getMetadata)
router.get('/app-version', metaController.getAppVersion)
router.get('/version', metaController.getVersion)

export default router
