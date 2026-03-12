/**
 * Extracts the API access token from cookies and returns it as an auth header.
 * Returns an empty object if no token is present.
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @returns {Record<string, string>} Auth headers object (can be empty or contain Cookie header)
 */
export function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	if (accessToken) {
		return { Cookie: `api-access-token=${accessToken}` };
	}
	return {};
}
