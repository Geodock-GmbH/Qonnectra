import type { Handle, ServerInit } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { install } from 'undici';

import { paraglideMiddleware } from '$lib/paraglide/server';

import { canAccessRoute } from '$lib/utils/permissions';
import { permissionKeyFor } from '$lib/config/routes';
import { landingPathFor, NO_ACCESS_PATH } from '$lib/server/landing';
import { resolveSession } from '$lib/server/session';

/** Routes accessible without authentication. */
export const PUBLIC_ROUTES = ['/login'];

/**
 * Replaces Node's bundled fetch with undici 8 before the first request.
 * The undici bundled with Node 22 crashes the whole process with an
 * uncatchable `assert(!this.paused)` when Django closes a connection while a
 * response body is still unread. `install()` swaps `fetch`, `Request`,
 * `Response`, `Headers` and `FormData` together, so the Requests Kit builds
 * still match the fetch it passes them to.
 *
 * Bug: https://github.com/nodejs/undici/issues/5360, fixed by
 * https://github.com/nodejs/undici/pull/5389 in undici 8.x only; the
 * 6.x (Node 22) and 7.x (Node 24) lines still crash.
 *
 * Removal: once the Node image in `frontend/Dockerfile` bundles a fixed undici
 * (check `node -p process.versions.undici`), drop this hook, the `undici`
 * dependency and the globals test in `src/hooks.server.init.test.ts`. Then
 * run its crash test without `init()` on that Node version: it must stay
 * green. Until then, keep the `undici` package on the 8.x line when upgrading.
 */
export const init: ServerInit = () => {
	install();
};

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

	if (requestedPath === NO_ACCESS_PATH) return resolve(event);

	const permissionKey = permissionKeyFor(event.route.id);
	const isLandingUrl = requestedPath === '/' || requestedPath.startsWith('/login');
	if (isLandingUrl || (permissionKey && !canAccessRoute(user.permissions, permissionKey))) {
		// The landing page is one the user may open, so this never redirects in a loop.
		const landing = await landingPathFor(event.fetch, event.cookies, user.permissions);
		redirect(303, landing);
	}

	return resolve(event);
}

export const handle = sequence(paraglideHandle, handleAuth);
