import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { API_URL } from '$env/static/private';
import setCookieParser from 'set-cookie-parser';

import { paraglideMiddleware } from '$lib/paraglide/server';

/** Routes accessible without authentication. */
export const PUBLIC_ROUTES = ['/login'];

/**
 * SvelteKit handle hook that applies Paraglide i18n middleware and injects the locale into HTML.
 * @type {import('@sveltejs/kit').Handle}
 */
const paraglideHandle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale);
			}
		});
	});

/**
 * Redirects bare project routes (e.g. `/dashboard`) to include the selected project slug.
 * @type {import('@sveltejs/kit').Handle}
 */
export async function handleProjectRedirect({ event, resolve }) {
	const url = event.url;
	const selectedProject = event.cookies.get('selected-project');

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
 * Attempts to refresh the access token using the refresh token cookie.
 * On success, sets new auth cookies on the event.
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @returns {Promise<boolean>} Whether the refresh succeeded and new cookies were set.
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
			const cookies = setCookieParser.parse(setCookieHeader);
			cookies.forEach((/** @type {any} */ cookie) => {
				/** @type {Record<string, any>} */
				const options = {
					path: cookie.path || '/',
					domain: cookie.domain,
					httpOnly: cookie.httpOnly,
					secure: cookie.secure || event.url.protocol === 'https:',
					sameSite: cookie.sameSite || 'Lax'
				};
				Object.keys(options).forEach((key) => options[key] === undefined && delete options[key]);
				event.cookies.set(cookie.name, cookie.value, /** @type {any} */ (options));
			});
		}

		return true;
	} catch (error) {
		console.error('Token refresh failed:', error);
		return false;
	}
}

/**
 * Deletes the access and refresh token cookies.
 * @param {import('@sveltejs/kit').RequestEvent} event
 */
function clearAuthCookies(event) {
	event.cookies.delete('api-access-token', { path: '/' });
	event.cookies.delete('api-refresh-token', { path: '/' });
}

/**
 * Checks if a user can access a route based on their permissions.
 * Supports exact matches and wildcard patterns (e.g. `/admin/*`).
 * @param {{ is_superuser?: boolean, routes?: Record<string, boolean> } | null} permissions
 * @param {string} route - The requested pathname.
 * @returns {boolean} Whether access is allowed (defaults to true when no rule matches).
 */
function canAccessRoute(permissions, route) {
	if (!permissions) return true;
	if (permissions.is_superuser) return true;
	if (permissions.routes?.['*'] === true) return true;

	if (permissions.routes && route in permissions.routes) {
		return permissions.routes[route];
	}

	for (const [pattern, allowed] of Object.entries(permissions.routes || {})) {
		if (pattern.endsWith('/*')) {
			const prefix = pattern.slice(0, -1);
			if (route.startsWith(prefix)) {
				return allowed;
			}
		}
	}

	return true;
}

/**
 * Authenticates the user by validating auth cookies against the API.
 * Populates `event.locals.user` and enforces route-level access control.
 * @type {import('@sveltejs/kit').Handle}
 */
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

		if (response.status === 401 || response.status === 403) {
			const refreshed = await attemptTokenRefresh(event);

			if (refreshed) {
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

			let permissions = null;
			const currentAccessToken = event.cookies.get('api-access-token');
			if (currentAccessToken) {
				const permHeaders = new Headers();
				permHeaders.append('Cookie', `api-access-token=${currentAccessToken}`);
				try {
					const permResponse = await event.fetch(`${API_URL}auth/permissions/`, {
						headers: permHeaders
					});
					if (permResponse.ok) {
						permissions = await permResponse.json();
					}
				} catch (permError) {
					console.error('Error fetching permissions:', permError);
				}
			}

			event.locals.user = {
				isAuthenticated: true,
				...userDetails,
				isAdmin: userDetails.is_staff || false,
				permissions
			};
		} else {
			if (response.status !== 401 && response.status !== 403) {
				console.error('API error fetching user:', response.status, await response.text());
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

	const isInternalApiRoute = requestedPath.startsWith('/api/');

	if (!isUserAuthenticated && !isPublicRoute && !isInternalApiRoute) {
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + event.url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	if (isUserAuthenticated && event.locals.user?.permissions) {
		if (!canAccessRoute(event.locals.user.permissions, requestedPath)) {
			throw redirect(303, '/map');
		}
	}

	return resolve(event);
}

export const handle = sequence(paraglideHandle, handleAuth, handleProjectRedirect);
