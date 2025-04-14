import { paraglideMiddleware } from '$lib/paraglide/server';
import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';
import { sequence } from '@sveltejs/kit/hooks';

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
	// We use event.fetch which automatically forwards cookies from the browser to the API.
	try {
		const response = await event.fetch(`${PUBLIC_API_URL}/api/v1/auth/user/`);

		if (response.ok) {
			const userDetails = await response.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails // e.g., username, email, pk
			};
		} else if (response.status === 401 || response.status === 403) {
			// Not authenticated or token invalid/expired
			event.locals.user = { isAuthenticated: false };
		} else {
			// Handle other potential API errors (e.g., 500)
			console.error('API error fetching user:', response.status, await response.text());
			event.locals.user = { isAuthenticated: false };
		}
	} catch (error) {
		// Handle network errors or API down
		console.error('Network error fetching user:', error);
		event.locals.user = { isAuthenticated: false };
	}

	// Protect specific routes (example)
	if (event.url.pathname.startsWith('/settings') && !event.locals.user.isAuthenticated) {
		// Redirect to login if trying to access '/dashboard' while not authenticated
		throw redirect(303, '/login');
	}

	// Load page as normal
	return resolve(event);
}

export const handle = sequence(handleParaglide, handleAuth);
