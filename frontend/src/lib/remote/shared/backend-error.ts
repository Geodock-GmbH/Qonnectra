import { error } from '@sveltejs/kit';

/**
 * Builds a user-facing message from a Django REST Framework error body.
 * A `detail` string wins; otherwise field errors are joined as
 * `field: message; other: message`, falling back to `fallback` when the
 * body carries nothing usable.
 * @param errorData - Parsed JSON error body (may be anything).
 * @param fallback - Message when the body has no detail or field errors.
 */
export function backendErrorMessage(errorData: unknown, fallback: string): string {
	if (!errorData || typeof errorData !== 'object') return fallback;
	const data = errorData as Record<string, unknown>;
	if (typeof data.detail === 'string' && data.detail) return data.detail;
	const fieldErrors = Object.entries(data)
		.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
		.join('; ');
	return fieldErrors || fallback;
}

/**
 * Turns a non-ok backend response into a Kit `HttpError` so the message
 * reaches the client. Plain `Error`s thrown from a remote function are
 * replaced by "Internal Error" before they leave the server.
 * @param response - The failed backend response.
 * @param fallback - Message when the body has no detail or field errors.
 */
export async function failFromResponse(response: Response, fallback: string): Promise<never> {
	const errorData = await response.json().catch(() => ({}));
	const status = response.status >= 400 && response.status <= 599 ? response.status : 500;
	error(status, backendErrorMessage(errorData, fallback));
}
