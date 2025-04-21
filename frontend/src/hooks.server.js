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
	const refreshToken = event.cookies.get('api-refresh-token'); // Get refresh token
	const headers = new Headers();

	// Manually add the Cookie header if the token exists
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
		// No need to forward the refresh token here for the /user/ request
	}

	try {
		// Use event.fetch WITH the manually constructed headers for the initial user fetch
		const initialResponse = await event.fetch(`${PUBLIC_API_URL}auth/user/`, {
			headers: headers // Pass the headers object here
		});

		if (initialResponse.ok) {
			const userDetails = await initialResponse.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails // username, email, pk
			};
		} else if ((initialResponse.status === 401 || initialResponse.status === 403) && refreshToken) {
			// Access token failed, but we have a refresh token, let's try refreshing
			console.log('Access token invalid/expired, attempting refresh...');
			try {
				const refreshResponse = await event.fetch(`${PUBLIC_API_URL}auth/token/refresh/`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					// If the backend expects the token in the body instead:
					body: JSON.stringify({ refresh: refreshToken })
				});

				if (refreshResponse.ok) {
					const { access: newAccessToken } = await refreshResponse.json(); // Assuming response format { "access": "..." }
					console.log('Token refreshed successfully.');

					// Update the access token cookie
					event.cookies.set('api-access-token', newAccessToken, {
						path: '/',
						httpOnly: true,
						secure: process.env.NODE_ENV === 'production',
						sameSite: 'lax',
						maxAge: 60 * 60 * 24 // Example: 1 day expiry, adjust as needed
					});

					// Retry fetching user details with the new access token
					const headersWithNewToken = new Headers();
					headersWithNewToken.append('Cookie', `api-access-token=${newAccessToken}`);
					const retryResponse = await event.fetch(`${PUBLIC_API_URL}auth/user/`, {
						headers: headersWithNewToken
					});

					if (retryResponse.ok) {
						const userDetails = await retryResponse.json();
						event.locals.user = { isAuthenticated: true, ...userDetails };
						console.log('User details fetched successfully after token refresh.');
					} else {
						// Retry failed even after successful refresh
						console.error(
							'Failed to fetch user details after token refresh:',
							retryResponse.status
						);
						// Clear cookies as something is wrong
						event.cookies.delete('api-access-token', { path: '/' });
						event.cookies.delete('api-refresh-token', { path: '/' }); // Clear refresh token too
						event.locals.user = { isAuthenticated: false };
					}
				} else {
					// Refresh request failed (e.g., refresh token expired or invalid)
					console.error('Token refresh failed:', refreshResponse.status);
					// Clear cookies as the refresh token is likely invalid
					event.cookies.delete('api-access-token', { path: '/' });
					event.cookies.delete('api-refresh-token', { path: '/' });
					event.locals.user = { isAuthenticated: false };
				}
			} catch (refreshError) {
				// Network or other error during the refresh request itself
				console.error('Error during token refresh request:', refreshError);
				event.cookies.delete('api-access-token', { path: '/' });
				event.cookies.delete('api-refresh-token', { path: '/' });
				event.locals.user = { isAuthenticated: false };
			}
		} else {
			// Handle other initial fetch errors (non-401/403) OR 401/403 without a refresh token
			if (initialResponse.status === 401 || initialResponse.status === 403) {
				console.log('Authentication failed (401/403) and no refresh token available.');
			} else {
				// Handle other potential API errors (e.g., 500)
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
			if (refreshToken && (initialResponse.status === 401 || initialResponse.status === 403)) {
				// Also clear refresh token if the initial failure was auth-related
				event.cookies.delete('api-refresh-token', { path: '/' });
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
		if (refreshToken) {
			event.cookies.delete('api-refresh-token', { path: '/' });
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
