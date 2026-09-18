import { isHttpError } from '@sveltejs/kit';

/**
 * Reads the message from an error thrown by a remote function call. Kit
 * `HttpError`s (raised server-side via `error()` / `failFromResponse`) carry
 * it in `body.message`; other errors expose `message` directly.
 * @param err - The rejection value of a remote function call.
 * @returns The message, or `null` when none is available.
 */
export function remoteErrorMessage(err: unknown): string | null {
	if (isHttpError(err)) return err.body?.message || null;
	if (err instanceof Error) return err.message || null;
	return null;
}

/**
 * Reads the HTTP status of a Kit `HttpError` thrown by a remote function so
 * callers can branch on it (for example 409 for a duplicate).
 * @param err - The rejection value of a remote function call.
 * @returns The status, or `null` for non-HTTP errors.
 */
export function remoteErrorStatus(err: unknown): number | null {
	return isHttpError(err) ? err.status : null;
}
