/**
 * Extracts the API access token from cookies and returns it as an auth header.
 * @param {import('@sveltejs/kit').Cookies | null} cookies - SvelteKit cookies object.
 * @returns {Record<string, string>} Auth headers object (empty if no token is present).
 */
export function getAuthHeaders(cookies) {
	const accessToken = cookies?.get('api-access-token');
	if (accessToken) {
		return { Cookie: `api-access-token=${accessToken}` };
	}
	return {};
}
