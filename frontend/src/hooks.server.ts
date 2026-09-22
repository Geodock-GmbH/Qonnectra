import type { Handle } from '@sveltejs/kit';
import type { Permissions } from '$lib/utils/permissions';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

import { paraglideMiddleware } from '$lib/paraglide/server';

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
 * Redirects bare project routes (e.g. `/dashboard`) to include the selected project slug.
 */
export async function handleProjectRedirect({ event, resolve }: Parameters<Handle>[0]) {
	const url = event.url;
	const selectedProject = event.cookies.get('selected-project');

	const PROJECT_ROUTES = [
		'/address',
		'/conduit',
		'/dashboard',
		'/fault-simulation',
		'/house-connections',
		'/map',
		'/network-schema',
		'/pipe-branch',
		'/trench',
		'/valuation'
	];

	const needsProjectSlug = PROJECT_ROUTES.some((route) => url.pathname === route);

	if (needsProjectSlug && selectedProject) {
		throw redirect(303, `${url.pathname}/${selectedProject}`);
	}

	return resolve(event);
}

/**
 * Checks if a user can access a route based on their permissions.
 * Supports exact matches and wildcard patterns (e.g. `/admin/*`).
 */
function canAccessRoute(permissions: Permissions | null, route: string): boolean {
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
 * Authenticates the request and enforces route-level access control.
 *
 * Per-request budget: at most one session lookup, answered from the in-memory
 * session cache for 30 s per access token (`resolveSession`), so a burst of
 * remote-function calls costs Django nothing after the first. The root layout
 * load reads nothing from the URL, so a same-route query change (`?page=`,
 * `?feature=`, `?tab=`) triggers zero layout fetches and, on a page without
 * a server `load`, no `__data.json` request at all. This hook is the single
 * auth gate; layout loads do not guard again.
 */
export async function handleAuth({ event, resolve }: Parameters<Handle>[0]) {
	event.locals.user = await resolveSession(event);

	const isUserAuthenticated = event.locals.user?.isAuthenticated ?? false;
	const requestedPath = event.url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	if ((isUserAuthenticated && requestedPath.startsWith('/login')) || requestedPath === '/') {
		throw redirect(303, '/map');
	}

	// Remote functions authenticate against Django themselves; the login form
	// in particular must reach its endpoint without a session.
	const isRemoteFunctionRoute = requestedPath.startsWith('/_app/remote/');

	if (!isUserAuthenticated && !isPublicRoute && !isRemoteFunctionRoute) {
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
