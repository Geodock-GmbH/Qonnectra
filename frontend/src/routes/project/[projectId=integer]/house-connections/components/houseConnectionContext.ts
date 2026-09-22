import type { NodeAssignmentManager } from './NodeAssignmentManager.svelte';
import type { MapInteractionManager } from '$lib/classes/MapInteractionManager.svelte';
import type { MapPopupManager } from '$lib/classes/MapPopupManager.svelte';
import type { MapSelectionManager } from '$lib/classes/MapSelectionManager.svelte';
import type { MapState } from '$lib/classes/MapState.svelte';
import type { LinkedTrenchHighlights } from '$lib/map/linkedTrenchHighlights';
import { createContext } from 'svelte';

/** The map plumbing the house-connections page hands to its map component. */
export interface HouseConnectionMapManagers {
	mapState: MapState;
	selectionManager: MapSelectionManager;
	popupManager: MapPopupManager;
	interactionManager: MapInteractionManager;
}

/** Interaction state the drawer shares with the map: node picking and trench highlights. */
export interface HouseConnectionInteraction {
	nodeAssignment: NodeAssignmentManager;
	trenchHighlights: LinkedTrenchHighlights;
}

export const [getHouseConnectionMapManagers, setHouseConnectionMapManagers] =
	createContext<HouseConnectionMapManagers>();

export const [getHouseConnectionInteraction, setHouseConnectionInteraction] =
	createContext<HouseConnectionInteraction>();
