import { Hono } from 'hono'
import { addressController } from '../controllers/addressController.ts'
import { createAddressSchema, updateAddressSchema } from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Addresses are private to their owner.
router.use('*', authMiddleware)

router.get('/user/:userId', addressController.getByUser)
router.get('/:id', addressController.getById)
router.post('/', validate(createAddressSchema), addressController.create)
router.patch('/:id', validate(updateAddressSchema), addressController.update)
router.delete('/:id', addressController.delete)
router.patch('/:id/default', addressController.setDefault)

export default router
