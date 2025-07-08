import { paraglideMiddleware } from '$lib/paraglide/server';
import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import { sequence } from '@sveltejs/kit/hooks';

// Define routes that should be accessible even without authentication
export const PUBLIC_ROUTES = ['/login']; // Add more routes here

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
export async function handleAuth({ event, resolve }) {
	// Attempt to get user data on every server-side navigation or page load.
	const accessToken = event.cookies.get('api-access-token');
	const headers = new Headers();

	// Manually add the Cookie header if the token exists
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}

	try {
		// Use event.fetch WITH the manually constructed headers for the initial user fetch
		const initialResponse = await event.fetch(`${API_URL}auth/user/`, {
			headers: headers // Pass the headers object here
		});

		if (initialResponse.ok) {
			const userDetails = await initialResponse.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails // username, email, pk
			};
		} else if (initialResponse.status === 401 || initialResponse.status === 403) {
			event.cookies.delete('api-access-token', { path: '/' });
			event.locals.user = { isAuthenticated: false };
		} else {
			if (initialResponse.status === 401 || initialResponse.status === 403) {
				console.log('Authentication failed (401/403) and no refresh token available.');
			} else {
				console.error(
					'API error fetching user:',
					initialResponse.status,
					await initialResponse.text()
				);
			}
			// Clear potentially invalid tokens
			if (accessToken) {
				event.cookies.delete('api-access-token', { path: '/' });
			}
			event.locals.user = { isAuthenticated: false };
		}
	} catch (error) {
		// Handle network errors or API down during the initial user fetch attempt
		console.error('Network error during initial user fetch:', error);
		// Attempt to clear cookies as state is unknown
		if (accessToken) {
			event.cookies.delete('api-access-token', { path: '/' });
		}
		event.locals.user = { isAuthenticated: false };
	}

	// Route Protection Logic
	const isUserAuthenticated = event.locals.user?.isAuthenticated ?? false;
	const requestedPath = event.url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	// If user is already authenticated and tries to access /login, redirect them away
	if (isUserAuthenticated && requestedPath.startsWith('/login')) {
		throw redirect(303, '/map');
	}

	if (!isUserAuthenticated && !isPublicRoute) {
		// User is not logged in and trying to access a protected route
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + event.url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	// If user is authenticated (and not on /login) OR the route is public, continue resolving the request
	return resolve(event);
}

export const handle = sequence(paraglideHandle, handleAuth);
