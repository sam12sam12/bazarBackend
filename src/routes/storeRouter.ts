import { Hono } from 'hono'
import { storeController } from '../controllers/storeController.ts'
import { createStoreSchema, updateStoreSchema } from '../db/validation.ts'
import { authMiddleware, optionalAuth } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// router.use('*', authMiddleware)
// Reads stay public; attach the user when signed in so getById can record a view.
router.use('*', optionalAuth)

// ── Store CRUD ───────────────────────────────────────────────────────────────
router.get('/suggestions', storeController.getSuggestions)
router.get('/', storeController.getAll)
router.get('/owner/:userId', storeController.getByOwner)

// ── Stores the signed-in user follows ─────────────────────────────────────────
router.get('/following/ids', authMiddleware, storeController.getFollowingIds)
router.get('/following/mine', authMiddleware, storeController.getFollowedStores)

router.get('/:id', storeController.getById)
router.get('/:id/dashboard', authMiddleware, storeController.getDashboard)
router.post(
	'/',
	authMiddleware,
	validate(createStoreSchema),
	storeController.create,
)
router.patch(
	'/:id',
	authMiddleware,
	validate(updateStoreSchema),
	storeController.update,
)
router.delete('/:id', authMiddleware, storeController.delete)

// ── Follow toggle ────────────────────────────────────────────────────────────
router.post('/:storeId/follow', authMiddleware, storeController.toggleFollow)

// ── Followers ────────────────────────────────────────────────────────────────
router.get('/:storeId/followers', storeController.getStoreFollowers)

export default router
