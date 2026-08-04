import type { Cookies } from '@sveltejs/kit';

/**
 * Extracts the API access token from cookies and returns it as an auth header.
 * @param cookies - SvelteKit cookies object.
 */
export function getAuthHeaders(cookies: Cookies | null): Record<string, string> {
	const accessToken = cookies?.get('api-access-token');
	if (accessToken) {
		return { Cookie: `api-access-token=${accessToken}` };
	}
	return {};
}
