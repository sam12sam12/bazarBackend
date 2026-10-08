import { timestamp } from 'drizzle-orm/pg-core'

// Shared column set spread into every domain table — see productSchema.ts.
// Keeping this in one place means a future change (e.g. adding an updatedBy
// trigger) only has to happen once.
export const timestamps = {
	// precision: 3 (milliseconds) matches what a JS `Date` can actually hold.
	// Without it, Postgres keeps microsecond precision, the pg driver returns
	// it as a millisecond-truncated `Date`, and a cursor built from that
	// truncated value no longer equals the column's real stored value —
	// silently dropping the pagination boundary row(s).
	created_at: timestamp('created_at', { withTimezone: true, precision: 3 })
		.defaultNow()
		.notNull(),
	updated_at: timestamp('updated_at', { withTimezone: true, precision: 3 })
		.defaultNow()
		.notNull()
		.$onUpdateFn(() => new Date()),
}
