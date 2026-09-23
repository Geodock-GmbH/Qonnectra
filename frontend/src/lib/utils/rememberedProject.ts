/**
 * The remembered project: the project the user most recently visited in this
 * browser. A preference, never navigation state. It picks the landing project
 * and gives global pages a default; every read validates it against the
 * user's projects. The cookie is its persistence, so the server can resolve
 * `/` in one hop and render nav hrefs on global pages correctly on first paint.
 */

/** A project as offered to the user: id as `value`, name as `label`. */
export interface ProjectOption {
	value: string;
	label: string;
}

/** Cookie holding the remembered project id. Never httpOnly: the client writes it too. */
export const LAST_PROJECT_COOKIE = 'last-project';

/** Cookie lifetime in seconds: one year. */
export const LAST_PROJECT_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Validates a remembered id against the user's projects.
 * @param id - The raw remembered id, e.g. from the cookie.
 * @param projects - The projects the user may see.
 * @returns The id when it names one of the projects, otherwise null.
 */
export function validRememberedProject(
	id: string | null | undefined,
	projects: readonly ProjectOption[]
): string | null {
	if (!id) return null;
	return projects.some((project) => project.value === id) ? id : null;
}

/**
 * Builds the `document.cookie` assignment that remembers a project.
 * @param id - The project id to remember.
 * @param secure - Whether the page is served over HTTPS.
 * @returns The cookie string with path, max-age and SameSite set.
 */
export function lastProjectCookie(id: string, secure: boolean): string {
	const attributes = [`path=/`, `max-age=${LAST_PROJECT_MAX_AGE}`, 'SameSite=Lax'];
	if (secure) attributes.push('Secure');
	return `${LAST_PROJECT_COOKIE}=${encodeURIComponent(id)}; ${attributes.join('; ')}`;
}

/**
 * The project a global page uses as a default for a form or a map: the
 * remembered project when it is one of the user's projects, else their first
 * project.
 * @param id - The remembered project id, or null when none is remembered.
 * @param projects - The projects the user may see.
 * @returns The project option, or null when the user has no projects.
 */
export function defaultProject(
	id: string | null | undefined,
	projects: readonly ProjectOption[]
): ProjectOption | null {
	const remembered = validRememberedProject(id, projects);
	return projects.find((project) => project.value === remembered) ?? projects[0] ?? null;
}
