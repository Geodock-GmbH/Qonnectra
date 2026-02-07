import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

import { paraglideMiddleware } from '$lib/paraglide/server';

// Define routes that should be accessible even without authentication
export const PUBLIC_ROUTES = ['/login'];

/** @type {import('@sveltejs/kit').Handle} */
const paraglideHandle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale);
			}
		});
	});

/** @type {import('@sveltejs/kit').Handle} */
export async function handleProjectRedirect({ event, resolve }) {
	const url = event.url;
	const selectedProject = event.cookies.get('selected-project');

	// Define routes that need project slug parameters
	const PROJECT_ROUTES = [
		'/dashboard',
		'/map',
		'/trench',
		'/conduit',
		'/pipe-branch',
		'/network-schema',
		'/house-connections',
		'/address'
	];

	const needsProjectSlug = PROJECT_ROUTES.some((route) => url.pathname === route);

	if (needsProjectSlug && selectedProject) {
		throw redirect(303, `${url.pathname}/${selectedProject}`);
	}

	return resolve(event);
}

/**
 * Attempt to refresh the access token using the refresh token cookie.
 * Returns true if refresh succeeded and new cookies were set.
 */
async function attemptTokenRefresh(event) {
	const refreshToken = event.cookies.get('api-refresh-token');
	if (!refreshToken) return false;

	try {
		const response = await event.fetch(`${API_URL}auth/token/refresh/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Cookie: `api-refresh-token=${refreshToken}`
			}
		});

		if (!response.ok) return false;

		const setCookieHeader = response.headers.get('set-cookie');
		if (setCookieHeader) {
			const cookies = setCookieParser.parse(response);
			cookies.forEach((cookie) => {
				const options = {
					path: cookie.path || '/',
					domain: cookie.domain,
					httpOnly: cookie.httpOnly,
					secure: cookie.secure || event.url.protocol === 'https:',
					sameSite: cookie.sameSite || 'Lax'
				};
				Object.keys(options).forEach(
					(key) => options[key] === undefined && delete options[key]
				);
				event.cookies.set(cookie.name, cookie.value, options);
			});
		}

		return true;
	} catch (error) {
		console.error('Token refresh failed:', error);
		return false;
	}
}

function clearAuthCookies(event) {
	event.cookies.delete('api-access-token', { path: '/' });
	event.cookies.delete('api-refresh-token', { path: '/' });
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handleAuth({ event, resolve }) {
	const accessToken = event.cookies.get('api-access-token');
	const headers = new Headers();

	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}

	try {
		let response = await event.fetch(`${API_URL}auth/user/`, {
			headers: headers
		});

		// If access token expired, attempt silent refresh
		if (response.status === 401 || response.status === 403) {
			const refreshed = await attemptTokenRefresh(event);

			if (refreshed) {
				// Retry with new access token
				const newAccessToken = event.cookies.get('api-access-token');
				const newHeaders = new Headers();
				if (newAccessToken) {
					newHeaders.append('Cookie', `api-access-token=${newAccessToken}`);
				}
				response = await event.fetch(`${API_URL}auth/user/`, {
					headers: newHeaders
				});
			}
		}

		if (response.ok) {
			const userDetails = await response.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails,
				isAdmin: userDetails.is_staff || false
			};
		} else {
			if (response.status !== 401 && response.status !== 403) {
				console.error(
					'API error fetching user:',
					response.status,
					await response.text()
				);
			}
			clearAuthCookies(event);
			event.locals.user = { isAuthenticated: false };
		}
	} catch (error) {
		console.error('Network error during user fetch:', error);
		clearAuthCookies(event);
		event.locals.user = { isAuthenticated: false };
	}

	const isUserAuthenticated = event.locals.user?.isAuthenticated ?? false;
	const requestedPath = event.url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	if ((isUserAuthenticated && requestedPath.startsWith('/login')) || requestedPath === '/') {
		throw redirect(303, '/map');
	}

	if (!isUserAuthenticated && !isPublicRoute) {
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + event.url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	return resolve(event);
}

export const handle = sequence(paraglideHandle, handleAuth, handleProjectRedirect);
