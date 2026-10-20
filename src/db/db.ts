import { SQL } from 'bun'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './schema'

export const pool = new SQL({
	url: process.env.DATABASE_URL,
	max: 10,
	idleTimeout: 30,
	connectionTimeout: 5,
	tls:
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
