import { Hono } from 'hono'
import { storeReviewController } from '../controllers/storeReviewController.ts'
import {
	insertStoreReviewSchema,
	reactToStoreReviewSchema,
	replyStoreReviewSchema,
	updateStoreReviewSchema,
} from '../db/validation.ts'
import { authMiddleware, optionalAuth } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Reads stay public but pick up the signed-in user (if any) so each review
// can report the caller's own like/dislike alongside it.
router.use('*', optionalAuth)

// ── Public reads ──
router.get('/store/:storeId', storeReviewController.getAll)
router.get('/store/:storeId/summary', storeReviewController.getSummary)
router.get('/:id', storeReviewController.getById)

// ── Authenticated writes ──
router.post(
	'/',
	authMiddleware,
	validate(insertStoreReviewSchema),
	storeReviewController.create,
)
router.patch(
	'/:id',
	authMiddleware,
	validate(updateStoreReviewSchema),
	storeReviewController.update,
)
router.delete('/:id', authMiddleware, storeReviewController.delete)
router.patch(
	'/:id/reply',
	authMiddleware,
	validate(replyStoreReviewSchema),
	storeReviewController.reply,
)
router.patch(
	'/:id/react',
	authMiddleware,
	validate(reactToStoreReviewSchema),
	storeReviewController.react,
)

export default router
