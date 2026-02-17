import { json } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

/**
 * POST /api/refresh
 * Client-callable endpoint to trigger JWT token refresh.
 * Used by the heartbeat to keep tokens fresh without navigation.
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
			parsedCookies.forEach((cookie) => {
				const options = {
					path: cookie.path || '/',
					domain: cookie.domain,
					httpOnly: cookie.httpOnly,
					secure: cookie.secure || url.protocol === 'https:',
					sameSite: cookie.sameSite || 'Lax'
				};
				Object.keys(options).forEach((key) => options[key] === undefined && delete options[key]);
				cookies.set(cookie.name, cookie.value, options);
			});
		}

		return json({ success: true });
	} catch (error) {
		console.error('Token refresh endpoint error:', error);
		return json({ success: false, reason: 'error' }, { status: 500 });
	}
}
