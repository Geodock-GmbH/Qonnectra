import { json } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

/**
 * Client-callable endpoint to trigger JWT token refresh.
 * Used by the heartbeat to keep tokens fresh without navigation.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {Promise<Response>} JSON with `{ success: boolean, reason?: string }`.
 */
export async function POST({ cookies, fetch, url }) {
	const refreshToken = cookies.get('api-refresh-token');

	if (!refreshToken) {
		return json({ success: false, reason: 'no_refresh_token' }, { status: 401 });
	}

	try {
		const response = await fetch(`${API_URL}auth/token/refresh/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Cookie: `api-refresh-token=${refreshToken}`
			}
		});

		if (!response.ok) {
			return json({ success: false, reason: 'refresh_failed' }, { status: 401 });
		}

		const setCookieHeader = response.headers.get('set-cookie');
		if (setCookieHeader) {
			const parsedCookies = setCookieParser.parse(response);
			parsedCookies.forEach(
				(
					/** @type {{ name: string, value: string, path?: string, domain?: string, httpOnly?: boolean, secure?: boolean, sameSite?: string }} */ cookie
				) => {
					/** @type {import('cookie').CookieSerializeOptions & { path: string }} */
					const options = {
						path: cookie.path || '/',
						domain: cookie.domain,
						httpOnly: cookie.httpOnly,
						secure: cookie.secure || url.protocol === 'https:',
						sameSite: /** @type {'lax' | 'strict' | 'none'} */ (
							(cookie.sameSite || 'Lax').toLowerCase()
						)
					};
					Object.keys(options).forEach(
						(key) =>
							options[/** @type {keyof typeof options} */ (key)] === undefined &&
							delete options[/** @type {keyof typeof options} */ (key)]
					);
					cookies.set(cookie.name, cookie.value, options);
				}
			);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Token refresh endpoint error:', error);
		return json({ success: false, reason: 'error' }, { status: 500 });
	}
}
