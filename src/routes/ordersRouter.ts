import { Hono } from 'hono'
import { ordersController } from '../controllers/ordersController.ts'
import {
	cancelOrderSchema,
	checkoutSchema,
	updateOrderStatusSchema,
} from '../db/validation.ts'
import { authMiddleware } from '../middlewares/authMiddleware.ts'
import { validate } from '../middlewares/validator.ts'

const router = new Hono()

// Every order endpoint is scoped to the signed-in user.
router.use('*', authMiddleware)

// ── Checkout (creates one order per store) ──
router.post('/checkout', validate(checkoutSchema), ordersController.checkout)

// ── Lists ──
router.get('/', ordersController.getBuyerOrders)
router.get('/store/:storeId', ordersController.getStoreOrders)

// ── Single order ──
router.get('/:id', ordersController.getById)

// ── Status transitions ──
router.patch(
	'/:id/status',
	validate(updateOrderStatusSchema),
	ordersController.updateStatus,
)
router.patch(
	'/:id/cancel',
	validate(cancelOrderSchema),
	ordersController.cancel,
)

export default router
