import { redirect } from '@sveltejs/kit';
import { PUBLIC_ROUTES } from '../hooks.server.js';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, url }) {
	const isUserAuthenticated = locals.user?.isAuthenticated ?? false;
	const requestedPath = url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	// If user is not authenticated and trying to access a protected route,
	// redirect them to login from the layout load function itself.
	if (!isUserAuthenticated && !isPublicRoute) {
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	// locals.user is populated by the hooks.server.js handle function
	return {
		user: locals.user
	};
}
