import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './schema/relations'

export const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
})

// `relations` wires up `db.query.*` (the relational query API) — a
// deliberate project convention (see CLAUDE.md's "Drizzle" section), even
// though it's the opposite of the installed `drizzle` (LobeHub) skill's
// "always use db.select().leftJoin(), never db.query.*" rule. Joined reads
// go through `db.query.<table>.findFirst({ with: {...} })` from here on —
// see productService.getById / storeService.getById.
export const db = drizzle({ client: pool, relations })

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
