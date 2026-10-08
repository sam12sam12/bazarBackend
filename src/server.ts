import * as Sentry from '@sentry/hono/bun'
import { sentry } from '@sentry/hono/bun'
import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { checkDatabaseConnection, pool } from './db/db.ts'
import { auth } from './lib/auth.ts'
import { setLocalServer } from './lib/fanout.ts'
import { publisher, subscriber } from './lib/redis.ts'
import { mutationAuth } from './middlewares/mutationAuth.ts'
import { authRateLimiter } from './middlewares/rateLimitMiddleware.ts'
import { trimMiddleware } from './middlewares/trimMiddleware.ts'
import addressRouter from './routes/addressRouter.ts'
import bannerRouter from './routes/bannerRouter.ts'
import chatRouter from './routes/chatRouter.ts'
import dashboardRouter from './routes/dashboardRouter.ts'
import favoriteProductRouter from './routes/favoriteProductRouter.ts'
import favoriteRequestRouter from './routes/favoriteRequestRouter.ts'
import favoriteStoreRouter from './routes/favoriteStoreRouter.ts'
import metaRouter from './routes/metaRouter.ts'
import notificationPreferenceRouter from './routes/notificationPreferenceRouter.ts'
import notificationRouter from './routes/notificationRouter.ts'
import orderRouter from './routes/ordersRouter.ts'
import productRequestRouter from './routes/productRequestRouter.ts'
import productReviewRouter from './routes/productReviewRouter.ts'
import productRouter from './routes/productRouter.ts'
import productViewRouter from './routes/productViewRouter.ts'
import pushTokenRouter from './routes/pushTokenRouter.ts'
import reportRouter from './routes/reportRouter.ts'
import storeReviewRouter from './routes/storeReviewRouter.ts'
import storeRouter from './routes/storeRouter.ts'
import storeViewRouter from './routes/storeViewRouter.ts'
import trendingSearchRouter from './routes/trendingSearchRouter.ts'
import uploadRouter from './routes/uploadRouter.ts'
import userRouter from './routes/userRouter.ts'
import wsRouter from './routes/wsRouter.ts'
import { ApiError } from './utils/ApiError.ts'
import { handleDatabaseError } from './utils/errorUtils.ts'

export const app = new Hono()
const PORT = process.env.PORT || 3000

// ✅ Sentry — must be registered as early as possible so it captures errors
// from every downstream middleware and route.
if (process.env.SENTRY_DSN) {
	app.use(
		'*',
		sentry(app, {
			dsn: process.env.SENTRY_DSN,
			tracesSampleRate: 1.0,
			enableLogs: true,
			environment: process.env.NODE_ENV || 'development',
		}),
	)
}

// ✅ Global Middlewares
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
	: ['http://localhost:3000', 'http://localhost:8081']

app.use(
	'*',
	cors({
		origin: allowedOrigins,
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization'],
		credentials: true,
	}),
)
app.use('*', trimMiddleware)

// ✅ Rate Limiter for Auth Routes
app.use('/api/auth/*', authRateLimiter)

// ✅ Global Error Handler
app.onError((err, c) => {
	const method = c.req.method
	const path = c.req.path

	// 1. Handle custom ApiError
	if (err instanceof ApiError) {
		console.error(
			`[${method}] ${path} - API ERROR: ${err.message}`,
			err.errors ? JSON.stringify(err.errors, null, 2) : '',
		)
		return c.json(
			{
				success: false,
				message: err.message,
				// errors: err.errors,
			},
			err.statusCode as ContentfulStatusCode,
		)
	}

	// 2. Handle database-specific errors (e.g., unique constraints)
	const dbError = handleDatabaseError(err)
	if (dbError) {
		console.error(`[${method}] ${path} - DB ERROR: ${dbError.message}`)
		return c.json(
			{ success: false, message: dbError.message },
			dbError.status as ContentfulStatusCode,
		)
	}

	// 3. Handle generic system/unknown errors — report these to Sentry, since
	// this branch means an unexpected/unhandled failure (ApiError and known DB
	// errors above are expected and intentionally not reported).
	Sentry.captureException(err)
	console.error(`[${method}] ${path} - UNKNOWN ERROR:`, err)
	return c.json(
		{
			success: false,
			message: 'Internal Server Error',
		},
		500,
	)
})

await checkDatabaseConnection()

// ✅ Better Auth Route
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
	return auth.handler(c.req.raw)
})

app.get('/', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

// ✅ Public reads, authenticated writes for every /api/v1 resource.
// (User-scoped GETs opt back in with `authMiddleware` on their own route.)
app.use('/api/v1/*', mutationAuth)

app.route('/api/v1/users', userRouter)
app.route('/api/v1/stores', storeRouter)
app.route('/api/v1/products', productRouter)
app.route('/api/v1/orders', orderRouter)
app.route('/api/v1/addresses', addressRouter)
app.route('/api/v1/banners', bannerRouter)
app.route('/api/v1/notifications', notificationRouter)
app.route('/api/v1/push-tokens', pushTokenRouter)
app.route('/api/v1/notification-preferences', notificationPreferenceRouter)
app.route('/api/v1/product-reviews', productReviewRouter)
app.route('/api/v1/product-views', productViewRouter)
app.route('/api/v1/store-reviews', storeReviewRouter)
app.route('/api/v1/store-views', storeViewRouter)
app.route('/api/v1/reports', reportRouter)
app.route('/api/v1/product-requests', productRequestRouter)
app.route('/api/v1/favorite-products', favoriteProductRouter)
app.route('/api/v1/favorite-stores', favoriteStoreRouter)
app.route('/api/v1/favorite-requests', favoriteRequestRouter)
app.route('/api/v1/meta', metaRouter)
app.route('/api/v1/trending-searches', trendingSearchRouter)
app.route('/api/v1/dashboard', dashboardRouter)
app.route('/api/v1/uploads', uploadRouter)
app.route('/api/v1/conversations', chatRouter)

// Outside `/api/v1/conversations` on purpose — this is a protocol upgrade,
// not a REST resource, and `authMiddleware` runs inside `wsRouter.ts`
// itself (before the upgrade), the same way chat's REST routes do.
app.route('/ws', wsRouter)

// `Bun.serve` (not the plain-object auto-serve export the rest of this
// file used to rely on) is required so `hono/bun`'s `websocket` dispatcher
// can be wired in alongside `fetch` — that dispatcher is what makes
// `upgradeWebSocket()` in wsRouter.ts actually upgrade a request instead of
// falling through to a normal 426 response. `setLocalServer` hands the
// resulting server to `lib/fanout.ts`, which needs a standing reference to
// call `.publish()` from outside any request (e.g. a presence change fired
// from `onClose`). `idleTimeout` bounds how stale presence can get if a
// connection dies without a clean close (e.g. the device loses signal).
const server = Bun.serve({
	port: Number(PORT),
	fetch: app.fetch,
	websocket: { ...websocket, idleTimeout: 120 },
})
setLocalServer(server)

let shuttingDown = false
async function shutdown(signal: string) {
	if (shuttingDown) return
	shuttingDown = true
	console.log(`\n${signal} received, shutting down gracefully...`)

	await server.stop()
	await pool.end()
	publisher.disconnect()
	subscriber.disconnect()

	console.log('✅ Shutdown complete')
	process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default server
