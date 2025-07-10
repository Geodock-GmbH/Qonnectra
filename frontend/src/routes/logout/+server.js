import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';
// TODO: Clicking logout when the map is loading tiles, creates a lot of network error toasts.
/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies, fetch, url }) {
	// Retrieve necessary cookies to forward/clear
	const refreshToken = cookies.get('api-refresh-token');
	const csrfToken = cookies.get('csrftoken');
	const accessToken = cookies.get('api-access-token');

	// Prepare headers for the API request
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
			parsedCookies.forEach((cookie) => {
				const { name, value, ...options } = cookie;

				// SvelteKit's cookies.set` needs `expires` as a Date object
				if (options.expires) {
					options.expires = new Date(options.expires);
				}

				options.secure = options.secure || url.protocol === 'https:';

				cookies.set(name, value, options);
			});
		}

		if (!response.ok && response.status !== 401) {
			// Ignore 401 Unauthorized, as it might mean the tokens were already invalid
			console.error('Backend logout failed:', response.status, await response.text());
		}
	} catch (error) {
		console.error('Error during logout API call:', error);
	}

	// Redirect to the login page
	throw redirect(303, '/login');
}
