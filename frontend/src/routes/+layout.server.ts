import type { LayoutServerLoad } from './$types';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

import packageJson from '../../package.json';

/**
 * Root layout server load: flags, projects, app version and the map
 * projection for authenticated users. Authentication itself is decided by
 * `handleAuth` in `hooks.server.ts`. The load reads nothing from the URL, so
 * a navigation reruns it only when `app:reference-data` is invalidated (or on
 * `invalidateAll()`), never for a query, hash or same-route param change.
 */
export const load: LayoutServerLoad = async ({ locals, fetch, cookies, depends }) => {
	depends('app:reference-data');
	const isUserAuthenticated = locals.user?.isAuthenticated ?? false;

	let selectedProject = cookies.get('selected-project') || null;

	let flags: { label: string; value: string }[] = [];
	let flagsError: string | null = null;
	let projects: { label: string; value: string }[] = [];
	let projectsError: string | null = null;
	let appVersion: string | null = null;
	let srid: unknown = null;
	let proj4Def: unknown = null;

	if (packageJson) {
		appVersion = packageJson.version;
	}

	if (isUserAuthenticated) {
		const headers = getAuthHeaders(cookies);

		const [flagsResponse, projectsResponse, configResponse] = await Promise.allSettled([
			fetch(`${API_URL}flags/`, { headers }),
			fetch(`${API_URL}projects/?active=1`, { headers }),
			fetch(`${API_URL}config/`, { headers })
		]);

		if (flagsResponse.status === 'fulfilled' && flagsResponse.value.ok) {
			try {
				const flagsData = await flagsResponse.value.json();
				const flagData = flagsData.results || flagsData;
				flags = flagData.map((f: Record<string, unknown>) => ({
					label: f.flag,
					value: (f.id as number).toString()
				}));
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
				projects = projectData.map((p: Record<string, unknown>) => ({
					label: p.project,
					value: (p.id as number).toString()
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
};
