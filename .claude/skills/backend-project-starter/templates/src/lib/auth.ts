import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/db";
import * as schema from "../db/schema";

// Mounted at `/api/auth/*` in server.ts — deliberately outside `/api/v1`,
// so better-auth's own handler doesn't go through the versioned-API
// conventions (controller/service shape) the rest of the routes follow.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // The Expo client (`@better-auth/expo/client`) needs the app's deep-link
  // scheme allowed as a trusted origin for the OAuth redirect round-trip,
  // plus Expo Go's `exp://` scheme in dev — see
  // https://better-auth.com/docs/integrations/expo. Replace "myapp://" with
  // this project's real scheme (app.json's `expo.scheme`) if the client is
  // Expo; drop this whole array if the client is web-only.
  trustedOrigins: [
    "myapp://",
    ...(process.env.NODE_ENV !== "production"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
      : []),
  ],

  // Reuses the existing `users` table instead of a separate better-auth
  // table — `email_verified`/`avatar` are the only two fields that needed
  // remapping (see userSchema.ts's comment). Every other model gets its own
  // table (see authSchema.ts) since nothing pre-existing to merge them into.
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      image: "avatar",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  // uuid everywhere, matching `users.id` (see backend-architect skill's "PK
  // type follows the entity's role") — better-auth's own default is a text
  // nanoid, which would make `users.id` two different id shapes depending
  // on whether a row came from seeding or from a real sign-in.
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // No password flow built yet — Google is the only way to get a session
  // for now. Re-enable this (and the `accounts.password` column already
  // supports it) if email/password sign-up is ever added.
  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    google: {
      // Google issues a separate OAuth client id per platform (web/iOS/
      // Android) under one project — the native idToken sign-in flow
      // (`authClient.signIn.social({ idToken: {...} })`) verifies the
      // token's audience against whichever of these it matches, so all
      // three are listed even if only one platform's client id is created
      // yet (the `.filter()` below drops whichever are unset).
      clientId: [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
      ].filter((id): id is string => !!id),
      // Only the browser-redirect authorization-code flow
      // (`createAuthorizationURL`) needs this — the native idToken flow this
      // app actually uses (`authClient.signIn.social({ idToken: {...} })`)
      // verifies the JWT against Google's public keys and checks `audience`
      // against `clientId` above, never touching the secret. Genuinely
      // optional here, not a placeholder waiting to be filled in.
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    },
  },

  plugins: [expo()],
});
