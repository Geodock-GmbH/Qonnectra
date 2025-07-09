import { redirect } from '@sveltejs/kit';
import { PUBLIC_ROUTES } from '../hooks.server.js';
import { API_URL } from '$env/static/private';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals, url, fetch, cookies }) {
	const isUserAuthenticated = locals.user?.isAuthenticated ?? false;
	const requestedPath = url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	// If user is not authenticated and trying to access a protected route,
	// redirect them to login from the layout load function itself.
	if (!isUserAuthenticated && !isPublicRoute) {
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	// Load common data for all authenticated pages
	let flags = [];
	let flagsError = null;
	let projects = [];
	let projectsError = null;
	let appVersion = null;

	// Get app version from package.json
	const packageJson = await fetch('/package.json').catch(() => null);
	if (packageJson) {
		const packageData = await packageJson.json();
		appVersion = packageData.version;
	}

	if (isUserAuthenticated) {
		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();
		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		// Load flags and projects in parallel
		const [flagsResponse, projectsResponse] = await Promise.allSettled([
			fetch(`${API_URL}flags/`, { headers }),
			fetch(`${API_URL}projects/`, { headers })
		]);

		// Handle flags response
		if (flagsResponse.status === 'fulfilled' && flagsResponse.value.ok) {
			try {
				const flagsData = await flagsResponse.value.json();
				const flagData = flagsData.results || flagsData;
				flags = flagData.map((f) => ({ label: f.flag, value: f.id.toString() }));
			} catch (e) {
				flagsError = 'Error parsing flags data';
				console.error('Failed to parse flags data:', e);
			}
		} else {
			flagsError = 'Failed to fetch flags';
			if (flagsResponse.status === 'rejected') {
				console.error('Failed to load flags:', flagsResponse.reason);
			}
		}

		// Handle projects response
		if (projectsResponse.status === 'fulfilled' && projectsResponse.value.ok) {
			try {
				const projectsData = await projectsResponse.value.json();
				const projectData = projectsData.results || projectsData;
				projects = projectData.map((p) => ({ label: p.project, value: p.id.toString() }));
			} catch (e) {
				projectsError = 'Error parsing projects data';
				console.error('Failed to parse projects data:', e);
			}
		} else {
			projectsError = 'Failed to fetch projects';
			if (projectsResponse.status === 'rejected') {
				console.error('Failed to load projects:', projectsResponse.reason);
			}
		}
	}

	// locals.user is populated by the hooks.server.js handle function
	return {
		user: locals.user,
		flags,
		flagsError,
		projects,
		projectsError,
		appVersion
	};
}
