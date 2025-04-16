import { redirect, fail } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
import { parse } from 'cookie';

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
				const cookies = setCookieHeader.split(',').map((cookieStr) => parse(cookieStr.trim()));

				cookies.forEach((cookieData) => {
					const [cookieName, cookieValue] = Object.entries(cookieData)[0];

					// Parse expires date carefully
					let expiresDate = undefined;
					if (cookieData.expires) {
						const parsedDate = new Date(cookieData.expires);
						if (!isNaN(parsedDate.getTime())) {
							// Check if the date is valid
							expiresDate = parsedDate;
						} else {
							console.warn(`Failed to parse expires date string: ${cookieData.expires}`);
						}
					}

					const options = {
						path: cookieData.path || '/',
						httpOnly: cookieData.hasOwnProperty('httponly'),
						secure: cookieData.hasOwnProperty('secure') || event.url.protocol === 'https:',
						sameSite: cookieData.samesite || 'Lax', // Default to Lax
						maxAge: cookieData['max-age'] ? parseInt(cookieData['max-age']) : undefined,
						expires: expiresDate // Use the validated date or undefined
					};
					Object.keys(options).forEach((key) => options[key] === undefined && delete options[key]);

					if (cookieName && cookieValue) {
						event.cookies.set(cookieName, cookieValue, options);
					}
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
