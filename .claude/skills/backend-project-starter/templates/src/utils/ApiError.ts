/**
 * Custom API Error class to handle HTTP errors consistently.
 */
export class ApiError extends Error {
	public readonly statusCode: number
	public readonly errors?: any

	constructor(statusCode: number, message: string, errors?: any) {
		super(message)
		this.statusCode = statusCode
		this.errors = errors
		this.name = 'ApiError'

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError)
		}
	}

	static badRequest(message: string, errors?: any) {
		return new ApiError(400, message, errors)
	}

	static unauthorized(message: string = 'Unauthorized') {
		return new ApiError(401, message)
	}

	static forbidden(message: string = 'Forbidden') {
		return new ApiError(403, message)
	}

	static notFound(message: string = 'Resource not found') {
		return new ApiError(404, message)
	}

	static conflict(message: string) {
		return new ApiError(409, message)
	}

	static tooManyRequests(message: string = 'Too many requests') {
		return new ApiError(429, message)
	}

	static internal(message: string = 'Internal Server Error') {
		return new ApiError(500, message)
	}
}
