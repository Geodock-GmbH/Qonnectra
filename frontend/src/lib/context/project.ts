import { createContext } from 'svelte';
import { page } from '$app/state';

/** The current project of a project-scoped page, as named by the URL. */
export interface ProjectContext {
	/** The project id from the route param. */
	readonly id: string;
	/** The project's display name, or an empty string while the list is unavailable. */
	readonly label: string;
}

const [getProjectContext, setProjectContext] = createContext<ProjectContext>();

export { getProjectContext, setProjectContext };

/**
 * The project id of the current route. Only meaningful under the project
 * prefix, where the `[projectId=integer]` matcher guarantees the param, so it
 * is typed as present: pages never treat the project as optional and never
 * fall back to a store. Reactive when read inside `$derived`.
 * @returns The project id from `page.params`.
 */
export function routeProjectId(): string {
	return page.params.projectId as string;
}
