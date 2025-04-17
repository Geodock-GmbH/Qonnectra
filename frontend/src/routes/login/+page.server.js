import { redirect, fail } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
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
			const response = await fetch(`${PUBLIC_API_URL}auth/login/`, {
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
				console.warn('Login API response did not contain a Set-Cookie header.');
				return fail(500, { error: 'Authentication response missing cookie.' });
			}
		} catch (error) {
			console.error('Error during login action fetch:', error);
			return fail(500, { error: 'An internal error occurred during login.' });
		}

		throw redirect(303, redirectTo);
	}
};
