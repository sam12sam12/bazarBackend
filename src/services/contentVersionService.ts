import { eq, sql } from 'drizzle-orm'
import { db } from '../db/db'
import { contentVersion } from '../db/schema'

const ROW_ID = 1

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const contentVersionService = {
	/** Current version. Self-heals to 1 if the row is missing. */
	async getVersion(): Promise<number> {
		const [row] = await db
			.select({ version: contentVersion.version })
			.from(contentVersion)
			.where(eq(contentVersion.id, ROW_ID))

		if (row) return row.version

		await db
			.insert(contentVersion)
			.values({ id: ROW_ID, version: 1 })
			.onConflictDoNothing()
		return 1
	},

	/**
	 * Atomically bump the version. Upserts to 2 if the row is missing. Pass the
	 * surrounding transaction so the bump commits with the mutation.
	 */
	async bumpVersion(tx: Tx | typeof db = db): Promise<void> {
		await tx
			.insert(contentVersion)
			.values({ id: ROW_ID, version: 2 })
			.onConflictDoUpdate({
				target: contentVersion.id,
				set: { version: sql`${contentVersion.version} + 1` },
			})
	},
}
