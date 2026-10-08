import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer } from 'better-auth/plugins'
import { db } from '../db/db'
import * as schema from '../db/schema'

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			users: schema.users,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	trustedOrigins: ['afghanbazar://'],
	advanced: {
		database: {
			generateId: () => crypto.randomUUID(),
		},
	},
	plugins: [bearer(), expo()],
	user: {
		modelName: 'users',
		fields: {
			email: 'email',
			name: 'name',
			image: 'avatar_url',
			emailVerified: 'email_verified',
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
	},
	session: {
		fields: {
			userId: 'user_id',
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at',
			ipAddress: 'ip_address',
			userAgent: 'user_agent',
		},
	},
	account: {
		fields: {
			userId: 'user_id',
			accountId: 'account_id',
			providerId: 'provider_id',
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
	},
	verification: {
		fields: {
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_MOBILE_WEB_CLIENT_ID || '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
		},
		// apple: {
		//   clientId: process.env.APPLE_CLIENT_ID || '',
		// },
	},
})
