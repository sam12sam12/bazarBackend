import { Hono } from 'hono'
import { productController } from '../controllers/productController.ts'
import {
	insertProductSchema,
	productImagesArraySchema,
	productSpecificationsSchema,
	removeImageSchema,
	updateProductSchema,
} from '../db/validation.ts'
import { authMiddleware, optionalAuth } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// router.use('*', authMiddleware)
// Reads stay public; attach the user when signed in so getById can record a view.
router.use('*', optionalAuth)

// ── Core CRUD ──
router.get('/suggestions', productController.getSuggestions)
router.get('/global', productController.getGlobal)
router.get('/popular', productController.getPopular)
router.get('/feed', productController.getFeed)
router.get('/province/:provinceId', productController.getByProvince)
router.get('/', productController.getAll)
router.get('/store/:storeId', productController.getByStore)
router.get('/:id/related', productController.getRelated)
router.get('/:id', productController.getById)
router.post('/', validate(insertProductSchema), productController.create)
router.patch('/:id', validate(updateProductSchema), productController.update)
router.delete('/:id', productController.delete)

// ── JSONB Images (stored in products.images column) ──
router.post(
	'/:id/images',
	validate(productImagesArraySchema),
	productController.addImages,
)
router.delete(
	'/:id/images',
	validate(removeImageSchema),
	productController.removeImage,
)
router.patch(
	'/:id/images',
	validate(productImagesArraySchema),
	productController.replaceImages,
)

// ── JSONB Specifications (stored in products.specifications column) ──
router.patch(
	'/:id/specifications',
	validate(productSpecificationsSchema),
	productController.updateSpecifications,
)

export default router
