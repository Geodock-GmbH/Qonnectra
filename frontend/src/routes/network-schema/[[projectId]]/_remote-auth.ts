import { getRequestEvent } from '$app/server';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Builds the Django auth headers for a remote function from the current
 * request's cookies. Must be called before the first `await` in a remote
 * function body, since `getRequestEvent()` needs the active request context.
 * @param json - When true, also sets `Content-Type: application/json` for write requests.
 * @returns Headers carrying the `api-access-token` cookie (and JSON content type when requested).
 */
export function djangoHeaders(json = false): Record<string, string> {
	const { cookies } = getRequestEvent();
	const auth = getAuthHeaders(cookies);
	return json ? { ...auth, 'Content-Type': 'application/json' } : auth;
}
