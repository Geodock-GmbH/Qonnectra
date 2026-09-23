import type { TokenRefreshResult } from '$lib/server/tokenRefresh';
import { command, getRequestEvent } from '$app/server';

import { evictSession } from '$lib/server/session';
import { refreshAccessToken } from '$lib/server/tokenRefresh';

/**
 * Extends the session by trading the refresh token for a new access token.
 * It loads nothing else: this is the whole cost of keeping a session alive,
 * so a keep-alive tick never re-runs a `load` or replaces page data.
 *
 * The cached session of the old access token is dropped on success, so the
 * next request resolves the user against the token it just received rather
 * than a 30 s-old entry keyed on the token that is being replaced.
 * @returns Whether the session was extended, plus the new token's lifetime when Django reports one.
 */
export const refreshSession = command(async (): Promise<TokenRefreshResult> => {
	const event = getRequestEvent();
	const previousToken = event.cookies.get('api-access-token');

	const result = await refreshAccessToken(event);
	if (result.ok) evictSession(previousToken);

	return result;
});
