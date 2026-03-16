import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import packageJson from '../../package.json';
import { PUBLIC_ROUTES } from '../hooks.server.js';

/**
 * Root layout server load function.
 * Redirects unauthenticated users to login and loads flags, projects, and app version
 * for authenticated users.
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ locals, url, fetch, cookies }) {
	const isUserAuthenticated = locals.user?.isAuthenticated ?? false;
	const requestedPath = url.pathname;
	const isPublicRoute = PUBLIC_ROUTES.some((route) => requestedPath.startsWith(route));

	if (!isUserAuthenticated && !isPublicRoute) {
		const redirectToUrl = `/login?redirectTo=${encodeURIComponent(requestedPath + url.search)}`;
		throw redirect(303, redirectToUrl);
	}

	let selectedProject = cookies.get('selected-project') || null;

	let flags = [];
	let flagsError = null;
	let projects = [];
	let projectsError = null;
	let appVersion = null;
	let srid = null;
	let proj4Def = null;

	if (packageJson) {
		appVersion = packageJson.version;
	}

	if (isUserAuthenticated) {
		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();
		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		const [flagsResponse, projectsResponse, configResponse] = await Promise.allSettled([
			fetch(`${API_URL}flags/`, { headers }),
			fetch(`${API_URL}projects/?active=1`, { headers }),
			fetch(`${API_URL}config/`, { headers })
		]);

		if (flagsResponse.status === 'fulfilled' && flagsResponse.value.ok) {
			try {
				const flagsData = await flagsResponse.value.json();
				const flagData = flagsData.results || flagsData;
				flags = flagData.map((/** @type {any} */ f) => ({ label: f.flag, value: f.id.toString() }));
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

		if (projectsResponse.status === 'fulfilled' && projectsResponse.value.ok) {
			try {
				const projectsData = await projectsResponse.value.json();
				const projectData = projectsData.results || projectsData;
				projects = projectData.map((/** @type {any} */ p) => ({
					label: p.project,
					value: p.id.toString()
				}));
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
		if (configResponse.status === 'fulfilled' && configResponse.value.ok) {
			try {
				const configData = await configResponse.value.json();
				srid = configData.srid;
				proj4Def = configData.proj4;
			} catch (e) {
				console.error('Failed to parse config data:', e);
			}
		} else if (configResponse.status === 'rejected') {
			console.error('Failed to load config:', configResponse.reason);
		}
	}

	if (!selectedProject && projects.length > 0) {
		selectedProject = projects[0].value;
	}
	if (!selectedProject) {
		selectedProject = '1';
	}

	return {
		user: locals.user,
		flags,
		flagsError,
		projects,
		projectsError,
		appVersion,
		selectedProject,
		srid,
		proj4Def
	};
}
