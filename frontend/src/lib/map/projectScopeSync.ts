import type { MapState } from '$lib/classes/MapState.svelte';

import { globalMapView, selectedProject } from '$lib/stores/store';

type ProjectScopedMapState = Pick<MapState, 'olMap' | 'selectedProject' | 'reinitializeForProject'>;

type ScopedMapState = ProjectScopedMapState & Pick<MapState, 'reinitializeForGlobalView'>;

/**
 * Keeps a map's tile sources in step with the selected project. Does nothing
 * until the map is ready, since the sources of an unmounted map are already
 * built for the current project.
 * @param mapState - The map state whose tile sources are rebuilt.
 * @param onProjectChange - Called after the map switched to another project.
 * @returns Stops the syncing; call it when the map is torn down.
 */
export function syncSelectedProject(
	mapState: ProjectScopedMapState,
	onProjectChange?: () => void
): () => void {
	return selectedProject.subscribe((project) => {
		if (!mapState.olMap || project === mapState.selectedProject) return;
		mapState.reinitializeForProject(project);
		onProjectChange?.();
	});
}

/**
 * Keeps a map's tile sources in step with the selected project and the global
 * view toggle, for the routes that offer the toggle. Does nothing until the
 * map is ready, since the sources of an unmounted map are already built for
 * the current scope.
 * @param mapState - The map state whose tile sources are rebuilt.
 * @param onProjectChange - Called after the map switched to another project.
 * @returns Stops the syncing; call it when the map is torn down.
 */
export function syncProjectScope(
	mapState: ScopedMapState,
	onProjectChange?: () => void
): () => void {
	const subscriptions = [
		syncSelectedProject(mapState, onProjectChange),
		globalMapView.subscribe((isGlobal) => {
			if (mapState.olMap) mapState.reinitializeForGlobalView(isGlobal);
		})
	];

	return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}
