import { API_URL } from '$env/static/private';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

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
		'/network-schema'
	];

	const needsProjectSlug = PROJECT_ROUTES.some((route) => url.pathname === route);

	if (needsProjectSlug && selectedProject) {
		throw redirect(303, `${url.pathname}/${selectedProject}`);
	}

	return resolve(event);
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handleAuth({ event, resolve }) {
	const accessToken = event.cookies.get('api-access-token');
	const headers = new Headers();

	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}

	try {
		const initialResponse = await event.fetch(`${API_URL}auth/user/`, {
			headers: headers
		});

		if (initialResponse.ok) {
			const userDetails = await initialResponse.json();
			event.locals.user = {
				isAuthenticated: true,
				...userDetails
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
			if (accessToken) {
				event.cookies.delete('api-access-token', { path: '/' });
			}
			event.locals.user = { isAuthenticated: false };
		}
	} catch (error) {
		console.error('Network error during initial user fetch:', error);
		if (accessToken) {
			event.cookies.delete('api-access-token', { path: '/' });
		}
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
