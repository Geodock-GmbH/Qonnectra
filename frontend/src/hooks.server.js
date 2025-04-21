import { paraglideMiddleware } from '$lib/paraglide/server';
import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
import { sequence } from '@sveltejs/kit/hooks';

// Define routes that should be accessible even without authentication
export const PUBLIC_ROUTES = ['/login']; // Add more routes here

const handleParaglide = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

/** @type {import('@sveltejs/kit').Handle} */
export async function handleAuth({ event, resolve }) {
	// Attempt to get user data on every server-side navigation or page load.
	const accessToken = event.cookies.get('api-access-token');
	const headers = new Headers();

	// Manually add the Cookie header if the token exists
	if (accessToken) {
		// Format according to HTTP Cookie header standard
		headers.append('Cookie', `api-access-token=${accessToken}`);
		// If you rely on other cookies being forwarded (like a refresh token), add them here too:
		// const refreshToken = event.cookies.get('api-refresh-token');
		// if (refreshToken) {
		//   headers.append('Cookie', `api-refresh-token=${refreshToken}`); // Note: Appending multiple Cookie headers might depend on server/fetch handling. Standard is one header with key=value pairs separated by '; '.
		// }
	}

	try {
		// Use event.fetch WITH the manually constructed headers
		const response = await event.fetch(`${PUBLIC_API_URL}auth/user/`, {
			headers: headers // Pass the headers object here
		});

		if (response.ok) {
			const userDetails = await response.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails // username, email, pk
			};
		} else if (response.status === 401 || response.status === 403) {
			// Not authenticated or token invalid/expired
			// Clear the potentially invalid cookie to prevent loops if auth fails
			if (accessToken) {
				event.cookies.delete('api-access-token', { path: '/' });
				// Consider deleting refresh token too if applicable
				// event.cookies.delete('api-refresh-token', { path: '/api/v1/auth/' }); // Use correct path
			}
			event.locals.user = { isAuthenticated: false };
		} else {
			// Handle other potential API errors (e.g., 500)
			console.error('API error fetching user:', response.status, await response.text());
			event.locals.user = { isAuthenticated: false };
		}
	} catch (error) {
		// Handle network errors or API down
		console.error('Network error fetching user:', error);
		// Attempt to clear cookie if network error occurs during auth check, as state is unknown
		if (accessToken) {
			event.cookies.delete('api-access-token', { path: '/' });
			// Consider deleting refresh token too if applicable
			// event.cookies.delete('api-refresh-token', { path: '/api/v1/auth/' }); // Use correct path
		}
		event.locals.user = { isAuthenticated: false };
	}

	// Route Protection Logic
	const isUserAuthenticated = event.locals.user?.isAuthenticated ?? false;
	const requestedPath = event.url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	// If user is already authenticated and tries to access /login, redirect them away
	if (isUserAuthenticated && requestedPath.startsWith('/login')) {
		throw redirect(303, '/'); // Redirect to home page or dashboard
	}

	if (!isUserAuthenticated && !isPublicRoute) {
		// User is not logged in and trying to access a protected route
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + event.url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	// If user is authenticated (and not on /login) OR the route is public, continue resolving the request
	return resolve(event);
}

export const handle = sequence(handleParaglide, handleAuth);
