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
	// 1. Find the root PostgreSQL error object
	let pgError = toPgError(err)

	// Traverse Drizzle's wrapped errors (check .cause, .originalError, .driverError, etc.)
	while (
		pgError.code === undefined &&
		(pgError.cause || pgError.originalError || pgError.driverError)
	) {
		pgError =
			pgError.cause ?? pgError.originalError ?? pgError.driverError ?? {}
	}

	// 2. Normalize properties
	const detail =
		pgError.detail ?? pgError.message ?? toPgError(err).message ?? ''
	const code = pgError.code ?? toPgError(err).code ?? ''

	// 3. PostgreSQL unique_violation error code (23505)
	const isUniqueViolation =
		code === '23505' ||
		detail.includes('23505') ||
		(toPgError(err).message ?? '').includes('23505')

	if (isUniqueViolation) {
		console.error({
			code: pgError.code,
			detail: pgError.detail,
			constraint: pgError.constraint,
			message: pgError.message,
		})
		// 1. Get specific segments - avoid the raw query message if possible
		const errorDetail = (pgError.detail ?? pgError.message ?? '').toLowerCase()
		const constraint = (
			pgError.constraint ??
			pgError.constraint_name ??
			''
		).toLowerCase()

		// 2. Use regex to find the specific field in the detail: "key (email)=(...) already exists."
		const match = errorDetail.match(/key \((.*?)\)=/i)
		const conflictingField = match?.[1]?.toLowerCase() ?? ''

		// 3. Identification logic - prioritize the extracted field
		if (constraint.includes('product_reviews_user_product_idx')) {
			return { status: 409, message: 'You have already reviewed this product.' }
		}
		if (constraint.includes('store_reviews_user_store_idx')) {
			return { status: 409, message: 'You have already reviewed this store.' }
		}
		if (conflictingField.includes('email') || constraint.includes('email')) {
			return { status: 409, message: 'Email address already exists.' }
		}
		if (
			conflictingField.includes('user_id') ||
			constraint.includes('user_id')
		) {
			return { status: 409, message: 'User ID already exists.' }
		}

		return {
			status: 409,
			message: 'A record with this unique value already exists.',
		}
	}

	return null
}
