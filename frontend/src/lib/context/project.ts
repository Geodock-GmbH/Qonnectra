import { createContext } from 'svelte';
import { afterNavigate } from '$app/navigation';
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

/**
 * Runs a callback after a navigation that changed the project in the URL
 * while the calling component stayed mounted: the same page in another
 * project. This is the single place that turns "the param changed" into a
 * side effect, for the few consumers that hold imperative state per project
 * (an OpenLayers map, a valuation in progress). Built on `afterNavigate`, so
 * it must be called during component initialisation and stops with the
 * component. The initial page load is not a change.
 * @param callback - Receives the project id the URL now names.
 */
export function onProjectChange(callback: (projectId: string) => void): void {
	afterNavigate(({ from, to }) => {
		const next = to?.params?.projectId;
		if (!from || !next || from.params?.projectId === next) return;
		callback(next);
	});
}
