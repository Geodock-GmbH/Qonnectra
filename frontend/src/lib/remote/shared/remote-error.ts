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
