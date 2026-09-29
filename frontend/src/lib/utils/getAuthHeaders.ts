import type { Cookies } from '@sveltejs/kit';

/**
 * Extracts the API access token from cookies and returns it as an auth header.
 * @param cookies - SvelteKit cookies object.
 * @returns A `Cookie` header carrying the access token, or an empty object when there is none.
 */
export function getAuthHeaders(cookies: Cookies | null): Record<string, string> {
	const accessToken = cookies?.get('api-access-token');
	if (accessToken) {
		return { Cookie: `api-access-token=${accessToken}` };
	}
	return {};
}

/**
 * Extracts the API refresh token from cookies for Django's token refresh endpoint.
 * @param cookies - SvelteKit cookies object.
 * @returns A `Cookie` header carrying the refresh token, or an empty object when there is none.
 */
export function getRefreshTokenHeaders(cookies: Cookies | null): Record<string, string> {
	const refreshToken = cookies?.get('api-refresh-token');
	if (refreshToken) {
		return { Cookie: `api-refresh-token=${refreshToken}` };
	}
	return {};
}
