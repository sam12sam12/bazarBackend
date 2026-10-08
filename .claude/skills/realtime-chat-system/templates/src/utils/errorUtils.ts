/** Shape of a raw PostgreSQL / Drizzle driver error */
interface PgErrorLike {
	code?: string
	detail?: string
	message?: string
	constraint?: string
	constraint_name?: string
	cause?: PgErrorLike
	originalError?: PgErrorLike
	driverError?: PgErrorLike
}

function toPgError(err: unknown): PgErrorLike {
	return (err ?? {}) as PgErrorLike
}

export function handleDatabaseError(
	err: unknown,
): { status: number; message: string } | null {
	let pgError = toPgError(err)

	while (
		pgError.code === undefined &&
		(pgError.cause || pgError.originalError || pgError.driverError)
	) {
		pgError = pgError.cause ?? pgError.originalError ?? pgError.driverError ?? {}
	}

	const detail = pgError.detail ?? pgError.message ?? toPgError(err).message ?? ''
	const code = pgError.code ?? toPgError(err).code ?? ''

	const isUniqueViolation =
		code === '23505' ||
		detail.includes('23505') ||
		(toPgError(err).message ?? '').includes('23505')

	if (isUniqueViolation) {
		return {
			status: 409,
			message: 'A record with this unique value already exists.',
		}
	}

	// A referenced row doesn't exist (e.g. a FK pointing at nothing) —
	// surfaces as 404, not 500, since it's a client-supplied bad reference,
	// not a server fault.
	const isForeignKeyViolation = code === '23503' || detail.includes('23503')
	if (isForeignKeyViolation) {
		return {
			status: 404,
			message: 'Related resource not found.',
		}
	}

	// Zod validates most of these first — this is the backstop for anything
	// that reaches the DB anyway.
	const isCheckViolation = code === '23514' || detail.includes('23514')
	if (isCheckViolation) {
		const constraint = (
			pgError.constraint ??
			pgError.constraint_name ??
			''
		).toLowerCase()
		return {
			status: 400,
			message: constraint
				? `Invalid data: "${constraint}" constraint failed.`
				: 'Invalid data.',
		}
	}

	return null
}
