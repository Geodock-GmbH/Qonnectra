import { redirect, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import { parse } from 'cookie';
import setCookieParser from 'set-cookie-parser';

/** @satisfies {import('./$types').Actions} */
export const actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');
		const redirectTo = formData.get('redirectTo') || '/';

		try {
			const response = await fetch(`${API_URL}auth/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': event.cookies.get('csrftoken') || ''
				},
				body: JSON.stringify({ username, password })
			});

			if (!response.ok) {
				const responseData = await response.json().catch(() => ({}));
				const errorMessage =
					responseData.non_field_errors?.[0] ||
					responseData.detail ||
					'Login failed. Please check your credentials.';
				return fail(response.status < 500 ? 400 : 500, { error: errorMessage });
			}

			// 1. Extract access token from the response body
			const responseData = await response.json();
			const accessToken = responseData.access;

			if (!accessToken) {
				console.error('Login response body missing "access" token.');
				return fail(500, { error: 'Authentication failed: Missing access token in response.' });
			}

			// 2. Set the access token cookie (mimic settings from hooks.server.js)
			event.cookies.set('api-access-token', accessToken, {
				path: '/',
				httpOnly: true,
				secure: event.url.protocol === 'https:', // Use same logic as hook
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 // Example: 1 day expiry - Align with hook or backend settings
			});

			// 3. Process and set cookies from Set-Cookie header (for refresh token)
			const setCookieHeader = response.headers.get('set-cookie');

			if (setCookieHeader) {
				// Use set-cookie-parser to properly parse the cookies
				const cookies = setCookieParser.parse(response);

				cookies.forEach((cookie) => {
					// Extract cookie options
					const options = {
						path: cookie.path || '/',
						httpOnly: cookie.httpOnly,
						secure: cookie.secure || event.url.protocol === 'https:',
						sameSite: cookie.sameSite || 'Lax',
						maxAge: cookie.maxAge,
						expires: cookie.expires
					};

					// Remove undefined options
					Object.keys(options).forEach((key) => options[key] === undefined && delete options[key]);

					// Set the cookie
					event.cookies.set(cookie.name, cookie.value, options);
				});
			} else {
				console.warn(
					'Login API response did not contain a Set-Cookie header (expected for refresh token).'
				);
				// Depending on requirements, this might be a failure
				// return fail(500, { error: 'Authentication response missing refresh token cookie.' });
			}
		} catch (error) {
			console.error('Error during login action fetch:', error);
			return fail(500, { error: 'An internal error occurred during login.' });
		}

		throw redirect(303, redirectTo);
	}
};
