import { redirect } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { API_URL } from '$env/static/private';

import { clearAuthCookies, forwardSetCookies, logoutHeaders } from './auth-session';

/**
 * Ends the backend session and clears the auth cookies, then redirects to
 * the login page. The local cookies are cleared even when the backend call
 * fails, so a user is never stuck logged in because the API was unreachable.
 */
export const logout = form(async () => {
	const { cookies, fetch, url } = getRequestEvent();

	try {
		const response = await fetch(`${API_URL}auth/logout/`, {
			method: 'POST',
			headers: logoutHeaders(cookies),
			credentials: 'include'
		});
		forwardSetCookies(cookies, response.headers.getSetCookie(), url.protocol === 'https:');
	} catch {
		// Backend unreachable: fall through to the local cookie cleanup.
	}

	clearAuthCookies(cookies);
	redirect(303, '/login');
});
