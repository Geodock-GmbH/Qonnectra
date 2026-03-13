import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

/**
 * Handles user logout by calling the backend API and clearing auth cookies.
 * @param {import('./$types').RequestEvent} event - SvelteKit request event
 * @returns {Promise<never>} Redirects to /login
 */
export async function POST({ cookies, fetch, url }) {
	const refreshToken = cookies.get('api-refresh-token');
	const csrfToken = cookies.get('csrftoken');
	const accessToken = cookies.get('api-access-token');

	/** @type {Record<string, string>} */
	const headers = {
		'Content-Type': 'application/json'
	};
	if (csrfToken) {
		headers['X-CSRFToken'] = csrfToken;
	}

	if (refreshToken) {
		headers['Cookie'] = `api-refresh-token=${refreshToken}`;
	}

	try {
		const response = await fetch(`${API_URL}auth/logout/`, {
			method: 'POST',
			headers: headers,
			credentials: 'include'
		});

		const setCookieHeader = response.headers.get('set-cookie');
		if (setCookieHeader) {
			const parsedCookies = setCookieParser.parse(response);
			parsedCookies.forEach((/** @type {Record<string, any>} */ cookie) => {
				const { name, value, ...options } = cookie;

				if (options.expires) {
					options.expires = new Date(options.expires);
				}

				options.secure = options.secure || url.protocol === 'https:';

				cookies.set(name, value, /** @type {import('cookie').CookieSerializeOptions & { path: string }} */ ({ ...options, path: options.path || '/' }));
			});
		}

		if (!response.ok && response.status !== 401) {
			console.error('Backend logout failed:', response.status, await response.text());
		}
	} catch (error) {
		console.error('Error during logout API call:', error);
	}

	cookies.delete('api-access-token', { path: '/' });
	cookies.delete('api-refresh-token', { path: '/' });

	throw redirect(303, '/login');
}
