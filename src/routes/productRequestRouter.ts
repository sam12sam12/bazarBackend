import { Hono } from 'hono'
import { productRequestController } from '../controllers/productRequestController.ts'
import {
	insertProductRequestSchema,
	updateProductRequestSchema,
	updateRequestStatusSchema,
} from '../db/validation.ts'
import { authMiddleware, optionalAuth } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// router.use('*', authMiddleware)

// ── Public reads ──
// optionalAuth (not authMiddleware) on both: the reads stay public, but each
// needs to know the caller's id (if any) to compute `isOwner`/`isSave`.
router.get('/suggestions', productRequestController.getSuggestions)
router.get('/', optionalAuth, productRequestController.getPublic)
router.get('/my', authMiddleware, productRequestController.getMyRequests)
router.get('/:id', optionalAuth, productRequestController.getById)

// ── Authenticated writes (owner/admin) ──
router.post(
	'/',
	authMiddleware,
	validate(insertProductRequestSchema),
	productRequestController.create,
)
router.patch(
	'/:id',
	authMiddleware,
	validate(updateProductRequestSchema),
	productRequestController.update,
)
router.patch(
	'/:id/status',
	authMiddleware,
	validate(updateRequestStatusSchema),
	productRequestController.setStatus,
)
router.delete('/:id', authMiddleware, productRequestController.remove)

export default router
