import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

import { paraglideMiddleware } from '$lib/paraglide/server';

import { canAccessRoute } from '$lib/utils/permissions';
import { permissionKeyFor } from '$lib/config/routes';
import { landingPathFor } from '$lib/server/landing';
import { resolveSession } from '$lib/server/session';

/** Routes accessible without authentication. */
export const PUBLIC_ROUTES = ['/login'];

/**
 * SvelteKit handle hook that applies Paraglide i18n middleware and injects the locale into HTML.
 */
const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale);
			}
		});
	});

/**
 * Authenticates the request, authorises the route and redirects landing URLs.
 * The hook knows nothing about which routes are project-scoped: the project
 * is a route param, and permission keys come from the route id.
 *
 * Per-request budget: at most one session lookup, answered from the in-memory
 * session cache for 30 s per access token (`resolveSession`), so a burst of
 * remote-function calls costs Django nothing after the first. This hook is
 * the single auth gate; layout loads do not guard again.
 */
export async function handleAuth({ event, resolve }: Parameters<Handle>[0]) {
	const user = await resolveSession(event);
	event.locals.user = user;

	// A remote call carries the URL of the page that made it, so it would be
	// redirected like that page. Remote functions authenticate against Django
	// themselves; the login form and the session keep-alive in particular must
	// reach their endpoints without a session.
	if (event.isRemoteRequest) return resolve(event);

	const requestedPath = event.url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	if (!user.isAuthenticated) {
		if (isPublicRoute) return resolve(event);
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + event.url.search)}`;
		redirect(303, redirectToUrl);
	}

	const permissionKey = permissionKeyFor(event.route.id);
	const isLandingUrl = requestedPath === '/' || requestedPath.startsWith('/login');
	if (isLandingUrl || (permissionKey && !canAccessRoute(user.permissions, permissionKey))) {
		// The landing page is one the user may open, so this never redirects in a loop.
		const landing = await landingPathFor(event.fetch, event.cookies, user.permissions);
		if (!landing) error(403, 'Access denied');
		redirect(303, landing);
	}

	return resolve(event);
}

export const handle = sequence(paraglideHandle, handleAuth);
