import { Hono } from 'hono'
import { buildShareRedirectHtml } from '../utils/shareRedirectHtml.ts'

const router = new Hono()

// Real, correctly-formatted for this app's actual package id — it just
// won't resolve to a live listing until the app is actually published.
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sam742.bazar'
// TODO: swap for the real numeric App Store id once this app has one
// (assigned in App Store Connect on first submission).
const IOS_STORE_URL = 'https://apps.apple.com/app/id0000000000'

// kind -> the expo-router path it deep-links into (see appScreens.ts on
// the frontend — every one of these already reads a plain `id` param).
const SHARE_TARGETS: Record<string, string> = {
	product: 'screens/ProductRelated/ProductDetailsScreen',
	store: 'screens/StoreRelated/SecondaryStoreScreen',
	request: 'screens/General/RequestDetailsScreen',
}

// Deliberately outside /api/v1 — this returns an HTML page for a browser
// to load, not a `{success,data}` JSON resource, and has no auth/DB
// dependency at all (the id is only ever handed to the app itself, which
// already handles a bad/missing id the same way a normal in-app navigation
// would).
router.get('/:kind/:id', (c) => {
	const { kind, id } = c.req.param()
	const screenPath = SHARE_TARGETS[kind]
	if (!screenPath || !id) return c.notFound()

	const userAgent = c.req.header('user-agent') ?? ''
	const isIOS = /iphone|ipad|ipod/i.test(userAgent)

	return c.html(
		buildShareRedirectHtml({
			deepLinkPath: `${screenPath}?id=${encodeURIComponent(id)}`,
			storeUrl: isIOS ? IOS_STORE_URL : ANDROID_STORE_URL,
		}),
	)
})

export default router
