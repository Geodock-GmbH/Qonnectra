/**
 * Get the auth header from the cookies
 * @param {Cookies} cookies - The cookies object
 * @returns {Object} The auth header as a plain object (spreadable)
 */
export function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	if (accessToken) {
		return { Cookie: `api-access-token=${accessToken}` };
	}
	return {};
}
