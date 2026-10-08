// Fails loudly at boot instead of failing confusingly mid-request. Without
// this, a missing R2_ACCOUNT_ID surfaces as a signature-mismatch error deep
// inside the first presign call, and a missing DATABASE_URL surfaces as
// whatever cryptic error `pg` throws for an undefined connection string —
// both reachable minutes or days after the process actually started.
//
// REDIS_URL and GOOGLE_CLIENT_SECRET are deliberately not required here —
// redis.ts defaults REDIS_URL to localhost, and the native idToken Google
// flow never uses the client secret (see auth.ts's comment).
//
// Drop the R2_* entries from REQUIRED (and the storage package) if this
// project doesn't need image/voice uploads — chat text-only still works
// without R2 configured.
const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL_BASE",
] as const;

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (!process.env.GOOGLE_WEB_CLIENT_ID && !process.env.GOOGLE_IOS_CLIENT_ID && !process.env.GOOGLE_ANDROID_CLIENT_ID) {
    missing.push("GOOGLE_WEB_CLIENT_ID (or GOOGLE_IOS_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID)" as (typeof REQUIRED)[number]);
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:\n" + missing.map((k) => `   - ${k}`).join("\n"));
    console.error("   See .env.example for what each one is and where it comes from.");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production" && process.env.BETTER_AUTH_SECRET!.length < 32) {
    console.error("❌ BETTER_AUTH_SECRET must be at least 32 characters in production.");
    process.exit(1);
  }
}
