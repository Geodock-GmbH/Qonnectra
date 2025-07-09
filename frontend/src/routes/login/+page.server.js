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
			const response = await event.fetch(`${API_URL}auth/login/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ username, password }),
				credentials: 'omit'
			});

			if (!response.ok) {
				const responseData = await response.json().catch(() => ({}));
				const errorMessage =
					responseData.non_field_errors?.[0] ||
					responseData.detail ||
					'Login failed. Please check your credentials.';
				return fail(response.status < 500 ? 400 : 500, { error: errorMessage });
			}

			// Process and set cookies from Set-Cookie header
			const setCookieHeader = response.headers.get('set-cookie');

			if (setCookieHeader) {
				// Use set-cookie-parser to properly parse the cookies
				const cookies = setCookieParser.parse(response);
				cookies.forEach((cookie) => {
					const options = {
						path: cookie.path || '/',
						domain: cookie.domain,
						httpOnly: cookie.httpOnly,
						secure: cookie.secure || event.url.protocol === 'https:',
						sameSite: cookie.sameSite || 'Lax'
					};

					// Remove undefined options
					Object.keys(options).forEach((key) => options[key] === undefined && delete options[key]);

					// Set the cookie on the browser's response
					event.cookies.set(cookie.name, cookie.value, options);
				});
			} else {
				console.warn(
					'Login API response did not contain a Set-Cookie header (expected for auth tokens).'
				);
				// This might be a failure condition if cookies are the only auth method
				return fail(500, { error: 'Authentication response missing required tokens.' });
			}
		} catch (error) {
			console.error('Error during login action fetch:', error);
			return fail(500, { error: 'An internal error occurred during login.' });
		}

		throw redirect(303, redirectTo);
	}
};
