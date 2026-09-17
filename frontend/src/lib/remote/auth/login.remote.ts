import { error, invalid, redirect } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import {
	ensureSelectedProjectCookie,
	forwardSetCookies,
	loginErrorMessage,
	safeRedirectTarget
} from './auth-session';

const LoginSchema = v.object({
	username: v.pipe(v.string(), v.nonEmpty()),
	_password: v.pipe(v.string(), v.nonEmpty()),
	redirectTo: v.optional(v.string(), '/')
});

/**
 * Authenticates against the backend, forwards the session cookies to the
 * browser and redirects to `redirectTo`. Rejected credentials become a
 * form-level issue; backend outages surface as a 500 `HttpError`.
 * The password field is underscored so a failed non-enhanced submission
 * never echoes it back into the page.
 */
export const login = form(LoginSchema, async ({ username, _password, redirectTo }) => {
	const { cookies, fetch, url } = getRequestEvent();
	const secure = url.protocol === 'https:';

	let response: Response;
	try {
		response = await fetch(`${API_URL}auth/login/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password: _password }),
			credentials: 'omit'
		});
	} catch {
		error(500, 'An internal error occurred during login.');
	}

	if (!response.ok) {
		const message = loginErrorMessage(await response.json().catch(() => ({})));
		if (response.status < 500) invalid(message);
		error(500, message);
	}

	const setCookieHeaders = response.headers.getSetCookie();
	if (setCookieHeaders.length === 0) {
		error(500, 'Authentication response missing required tokens.');
	}
	forwardSetCookies(cookies, setCookieHeaders, secure);
	ensureSelectedProjectCookie(cookies, secure);

	redirect(303, safeRedirectTarget(redirectTo));
});
