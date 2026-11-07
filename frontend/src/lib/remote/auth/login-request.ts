/**
 * Builds the backend login request. The endpoint reads credentials from a
 * form-encoded body; a JSON body is rejected by deployments that restrict the
 * accepted parsers.
 * @param username - The submitted username.
 * @param password - The submitted password.
 * @returns The request init for Django's login endpoint.
 */
export function loginRequestInit(username: string, password: string): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ username, password }),
		credentials: 'omit'
	};
}
