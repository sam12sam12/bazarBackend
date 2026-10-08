import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
	ssl:
		process.env.NODE_ENV === 'production'
			? { rejectUnauthorized: true }
			: false,
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
