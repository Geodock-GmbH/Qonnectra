import type { LayoutServerLoad } from './$types';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { LAST_PROJECT_COOKIE, validRememberedProject } from '$lib/utils/rememberedProject';
import { EMPTY_REFERENCE_DATA, loadReferenceData } from '$lib/server/reference-data';

import packageJson from '../../package.json';

/**
 * Root layout server load: flags, projects, app version, the map projection
 * and the remembered project for authenticated users. Authentication itself
 * is decided by `handleAuth` in `hooks.server.ts`. The load reads nothing
 * from the URL, so a navigation reruns it only when `app:reference-data` is
 * invalidated (or on `invalidateAll()`), never for a query, hash or
 * same-route param change.
 */
export const load: LayoutServerLoad = async ({ locals, fetch, cookies, depends }) => {
	depends('app:reference-data');
	const isUserAuthenticated = locals.user?.isAuthenticated ?? false;

	const reference = isUserAuthenticated
		? await loadReferenceData(fetch, getAuthHeaders(cookies))
		: EMPTY_REFERENCE_DATA;

	const rememberedProject =
		validRememberedProject(cookies.get(LAST_PROJECT_COOKIE), reference.projects) ??
		reference.projects[0]?.value ??
		null;

	return {
		user: locals.user,
		...reference,
		appVersion: (packageJson.version as string | undefined) ?? null,
		rememberedProject
	};
};
