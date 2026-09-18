import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
import type { MapState } from '$lib/classes/MapState.svelte';
import { createContext } from 'svelte';

/** The map plumbing the trench page hands to its map component. */
export interface TrenchMapManagers {
	mapState: MapState;
	selectionManager: MapSelectionManager;
}

export const [getTrenchMapManagers, setTrenchMapManagers] = createContext<TrenchMapManagers>();
