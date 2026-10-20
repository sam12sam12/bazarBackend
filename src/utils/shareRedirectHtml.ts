interface ShareRedirectParams {
	/** expo-router path + query, e.g. "screens/ProductRelated/ProductDetailsScreen?id=123" */
	deepLinkPath: string
	storeUrl: string
}

/**
 * The page a shared product/store/request link actually opens. Tries the
 * app's own scheme first — if Afghan Bazar is installed, the OS hands off
 * to it immediately and this page is never even seen. If nothing takes
 * over within MS_BEFORE_STORE_FALLBACK (app not installed), it falls
 * through to the store link instead.
 *
 * This is the pre-launch stand-in for real iOS Universal Links / Android
 * App Links, which need a verified production domain this project doesn't
 * have yet (see shareRouter.ts). Once that domain exists, the OS will
 * intercept these same /s/:kind/:id URLs before they ever reach this page
 * on a device with the app installed — this page keeps working unchanged
 * as the fallback for "not installed" / "not verified" / desktop.
 *
 * The auto-redirect script above is what fires in a normal browser, but
 * in-app browsers (WhatsApp, Instagram, Messenger) commonly block an
 * *automatic* script-triggered navigation to a custom scheme like
 * `afghanbazar://` as an anti-abuse measure — even with the app installed,
 * that silent failure would otherwise just fall through to the store link
 * incorrectly. A real `<a href="afghanbazar://...">` the person taps
 * themselves is a deliberate user gesture, which those same in-app
 * browsers are far more likely to actually honor — so it's shown as a
 * visible fallback button, not just left to the script.
 */
export function buildShareRedirectHtml({ deepLinkPath, storeUrl }: ShareRedirectParams): string {
	const deepLink = `afghanbazar://${deepLinkPath}`
	const MS_BEFORE_STORE_FALLBACK = 1500

	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Afghan Bazar</title>
    <meta property="og:title" content="Afghan Bazar" />
    <meta property="og:description" content="Open this in the Afghan Bazar app" />
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f7f9f9;
        font-family: -apple-system, Roboto, sans-serif;
        text-align: center;
        color: #0d0d0d;
      }
      .box { padding: 24px; }
      .button {
        display: inline-block;
        margin-top: 16px;
        padding: 12px 28px;
        background: #1dbf73;
        color: #fff;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
      }
      .button.secondary {
        background: transparent;
        color: #1dbf73;
        border: 1px solid #1dbf73;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <p>Opening Afghan Bazar…</p>
      <div>
        <a class="button" href="${deepLink}">Open in app</a>
      </div>
      <div>
        <a class="button secondary" href="${storeUrl}">Get the app</a>
      </div>
    </div>
    <script>
      window.location.href = ${JSON.stringify(deepLink)};
      setTimeout(function () {
        window.location.href = ${JSON.stringify(storeUrl)};
      }, ${MS_BEFORE_STORE_FALLBACK});
    </script>
  </body>
</html>`
}
