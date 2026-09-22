import type { Cookies } from '@sveltejs/kit';
import type { ProjectOption } from '$lib/utils/rememberedProject';
import { resolve } from '$app/paths';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { LAST_PROJECT_COOKIE, validRememberedProject } from '$lib/utils/rememberedProject';
import { fetchProjects } from '$lib/server/reference-data';

/**
 * Where a user goes without a destination: the map of the preferred project
 * when it is one of theirs, else of their first project. A user with no
 * projects lands on the settings page. Never a hardcoded project id.
 * @param projects - The projects the user may see.
 * @param preferredProjectId - The remembered project id, e.g. from the cookie.
 * @returns The landing path.
 */
export function resolveLandingPath(
	projects: readonly ProjectOption[],
	preferredProjectId: string | null | undefined
): string {
	const projectId = validRememberedProject(preferredProjectId, projects) ?? projects[0]?.value;
	if (!projectId) return resolve('/settings');
	return resolve('/project/[projectId=integer]/map', { projectId });
}

/**
 * The landing path for the user behind a request, fetching their projects
 * with the request's cookies.
 * @param fetch - The request's fetch.
 * @param cookies - The request's cookie jar, carrying the access token and the remembered project.
 * @returns The landing path.
 */
export async function landingPathFor(
	fetch: typeof globalThis.fetch,
	cookies: Cookies
): Promise<string> {
	const { projects } = await fetchProjects(fetch, getAuthHeaders(cookies));
	return resolveLandingPath(projects, cookies.get(LAST_PROJECT_COOKIE));
}
