import { Hono } from 'hono'
import { bannerController } from '../controllers/bannerController'
import { insertBannerSchema, updateBannerSchema } from '../db/validation'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator'

const router = new Hono()

// router.use('*', authMiddleware)

router.get('/', bannerController.getAll)
router.get('/:id', bannerController.getById)
router.post('/', validate(insertBannerSchema), bannerController.create)
router.patch('/:id', validate(updateBannerSchema), bannerController.update)
router.delete('/:id', bannerController.delete)

export default router
