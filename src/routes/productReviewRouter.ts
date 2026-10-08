import { Hono } from 'hono'
import { productReviewController } from '../controllers/productReviewController.ts'
import {
	insertProductReviewSchema,
	reactToProductReviewSchema,
	replyProductReviewSchema,
	updateProductReviewSchema,
} from '../db/validation.ts'
import { authMiddleware, optionalAuth } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Reads stay public but pick up the signed-in user (if any) so each review
// can report the caller's own like/dislike alongside it.
router.use('*', optionalAuth)

// ── Public reads ──
router.get('/product/:productId', productReviewController.getAll)
router.get('/product/:productId/summary', productReviewController.getSummary)
router.get('/:id', productReviewController.getById)

// ── Authenticated writes ──
router.post(
	'/',
	authMiddleware,
	validate(insertProductReviewSchema),
	productReviewController.create,
)
router.patch(
	'/:id',
	authMiddleware,
	validate(updateProductReviewSchema),
	productReviewController.update,
)
router.delete('/:id', authMiddleware, productReviewController.delete)
router.patch(
	'/:id/reply',
	authMiddleware,
	validate(replyProductReviewSchema),
	productReviewController.reply,
)
router.patch(
	'/:id/react',
	authMiddleware,
	validate(reactToProductReviewSchema),
	productReviewController.react,
)

export default router
