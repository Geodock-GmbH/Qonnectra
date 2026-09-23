import type { RequestEvent } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getRefreshTokenHeaders } from '$lib/utils/getAuthHeaders';
import { forwardSetCookies } from '$lib/remote/auth/auth-session';

/** What a successful refresh tells the caller about the new access token. */
export interface TokenRefreshResult {
	/** True when new tokens were set on the response. */
	ok: boolean;
	/** Lifetime of the new access token in ms, when Django reported one. */
	expiresInMs?: number;
}

/**
 * Reads the access token lifetime from Django's refresh payload. Simple JWT
 * reports it as `access_expiration`, an ISO timestamp; older setups omit it.
 * @param payload - The parsed refresh response body.
 * @returns The remaining lifetime in ms, or undefined when it cannot be read.
 */
function accessTokenLifetime(payload: unknown): number | undefined {
	if (!payload || typeof payload !== 'object') return undefined;
	const expiration = (payload as { access_expiration?: unknown }).access_expiration;
	if (typeof expiration !== 'string') return undefined;

	const remaining = new Date(expiration).getTime() - Date.now();
	return Number.isFinite(remaining) && remaining > 0 ? remaining : undefined;
}

/**
 * Trades the refresh token for a new access token and forwards Django's
 * cookies onto the response, so both a retry inside this request and the
 * browser see the new token. This is the only place that talks to Django's
 * refresh endpoint: the request hook uses it to recover a rejected access
 * token, the session keep-alive command to extend a live one.
 * @param event - The request whose cookies may carry a refresh token.
 * @returns Whether tokens were set, plus the new token's lifetime when known.
 */
export async function refreshAccessToken(event: RequestEvent): Promise<TokenRefreshResult> {
	const refreshHeaders = getRefreshTokenHeaders(event.cookies);
	if (!('Cookie' in refreshHeaders)) return { ok: false };

	try {
		const response = await event.fetch(`${API_URL}auth/token/refresh/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...refreshHeaders }
		});
		if (!response.ok) return { ok: false };

		const payload = await response.json().catch(() => null);
		forwardSetCookies(
			event.cookies,
			response.headers.getSetCookie?.() ?? [],
			event.url.protocol === 'https:'
		);
		return { ok: true, expiresInMs: accessTokenLifetime(payload) };
	} catch (error) {
		console.error('Token refresh failed:', error);
		return { ok: false };
	}
}
