import type { MapState } from '$lib/classes/MapState.svelte';

import { globalMapView } from '$lib/stores/store';

type ProjectScopedMapState = Pick<MapState, 'olMap' | 'selectedProject' | 'reinitializeForProject'>;

type GlobalViewMapState = Pick<MapState, 'olMap' | 'reinitializeForGlobalView'>;

/**
 * Rebuilds a map's tile sources for the project the URL now names. Called
 * from `onProjectChange`, so the URL stays the only source of the project
 * and the map is its cache. Does nothing until the map is ready, since the
 * sources of an unmounted map are already built for the current project,
 * and nothing when the map already shows that project.
 * @param mapState - The map state whose tile sources are rebuilt.
 * @param projectId - The project id from the URL.
 * @param onSwitched - Called after the map switched to another project.
 */
export function syncMapProject(
	mapState: ProjectScopedMapState,
	projectId: string,
	onSwitched?: () => void
): void {
	if (!mapState.olMap || projectId === mapState.selectedProject) return;
	mapState.reinitializeForProject(projectId);
	onSwitched?.();
}

/**
 * Keeps a map's tile sources in step with the global view toggle, for the
 * routes that offer the toggle. Does nothing until the map is ready.
 * @param mapState - The map state whose tile sources are rebuilt.
 * @returns Stops the syncing; call it when the map is torn down.
 */
export function syncGlobalView(mapState: GlobalViewMapState): () => void {
	return globalMapView.subscribe((isGlobal) => {
		if (mapState.olMap) mapState.reinitializeForGlobalView(isGlobal);
	});
}
