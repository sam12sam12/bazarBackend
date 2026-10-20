import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Bun's native `SQL` client double-encodes every jsonb column written
// through Drizzle (confirmed on images, specifications, category names,
// notifications, orders, reviews) — an upstream incompatibility between
// Drizzle's generic `jsonb` column type (which always pre-stringifies) and
// Bun's own driver (which JSON-encodes again on top of that). `pg` sends
// string params as plain text and lets Postgres cast it, so it doesn't
// have this bug — use it instead despite the app otherwise preferring
// Bun-native APIs.
export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
	// Whether Postgres needs TLS depends on the host, not on NODE_ENV — a
	// production DB on an internal/private network (e.g. same docker
	// network) commonly has no TLS listener at all. Opt in explicitly.
	ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
})

export const db = drizzle({ client: pool, schema })

// ✅ Database connection test
export async function checkDatabaseConnection() {
	try {
		await db.execute(sql`SELECT 1`)
		console.log('✅ Database connected successfully')
	} catch (error) {
		console.error('❌ Database connection failed')
		console.error(error)
		process.exit(1)
	}
}
