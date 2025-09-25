/**
 * Get the auth header from the cookies
 * @param {Cookies} cookies - The cookies object
 * @returns {Headers} The auth header
 */
export function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	const headers = new Headers();
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}
	return headers;
}
