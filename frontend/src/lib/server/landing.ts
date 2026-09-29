import type { Cookies } from '@sveltejs/kit';
import type { NavLink } from '$lib/config/navLinks';
import type { Permissions } from '$lib/utils/permissions';
import type { ProjectOption } from '$lib/utils/rememberedProject';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { canAccessRoute } from '$lib/utils/permissions';
import { LAST_PROJECT_COOKIE, validRememberedProject } from '$lib/utils/rememberedProject';
import { allNavLinks, navHref } from '$lib/config/navLinks';
import { fetchProjects } from '$lib/server/reference-data';

/** Where a signed-in user who may open no page is told to contact their administrator. */
export const NO_ACCESS_PATH = '/no-access';

/**
 * Pages a user can land on: every sidebar entry except the admin logs, whose
 * load sends non-admins back to the landing page and would bounce them.
 */
const LANDING_CANDIDATES = allNavLinks.filter((link) => link.id !== 'logs');

/**
 * Where a user goes without a destination: the map of the preferred project
 * when it is one of theirs, else of their first project; without projects,
 * the settings page. When the route permissions deny that page, the first
 * page in sidebar order the user may open; with none at all, the no-access
 * notice. Never a hardcoded project id.
 * @param projects - The projects the user may see.
 * @param preferredProjectId - The remembered project id, e.g. from the cookie.
 * @param permissions - The user's permissions; missing permissions allow every page.
 * @returns The landing path.
 */
export function resolveLandingPath(
	projects: readonly ProjectOption[],
	preferredProjectId: string | null | undefined,
	permissions?: Permissions | null
): string {
	const projectId = validRememberedProject(preferredProjectId, projects) ?? projects[0]?.value;
	const defaultId = projectId ? 'map' : 'settings';
	const reachable = LANDING_CANDIDATES.filter((link) => projectId || link.scope === 'global');
	const ordered: NavLink[] = [
		...reachable.filter((link) => link.id === defaultId),
		...reachable.filter((link) => link.id !== defaultId)
	];
	const landing = ordered.find((link) => canAccessRoute(permissions, link.permissionKey));
	return landing ? navHref(landing, projectId) : NO_ACCESS_PATH;
}

/**
 * The landing path for the user behind a request, fetching their projects
 * with the request's cookies.
 * @param fetch - The request's fetch.
 * @param cookies - The request's cookie jar, carrying the access token and the remembered project.
 * @param permissions - The user's permissions; missing permissions allow every page.
 * @returns The landing path.
 */
export async function landingPathFor(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	permissions?: Permissions | null
): Promise<string> {
	const { projects } = await fetchProjects(fetch, getAuthHeaders(cookies));
	return resolveLandingPath(projects, cookies.get(LAST_PROJECT_COOKIE), permissions);
}
