import { writable } from 'svelte/store';

import { persisted } from './persisted';
import { session } from './session';

/** Default center coordinates */
/** @type {[number, number]} */
const defaultCenter = [0, 0];

/** Default zoom level */
/** @type {number} */
const defaultZoom = 2;

/** Default flag value */
/** @type {string[]} */
const defaultFlagValue = ['1'];

/** Default trench color */
/** @type {string} */
const defaultTrenchColor = '#000000';

/** Whether the sidebar is expanded */
export const sidebarExpanded = persisted('isSidebarExpanded', true);

/** Selected project */
/** @type {import('svelte/store').Writable<string>} */
export const selectedProject = writable('1');

/** Map center */
/** @type {import('svelte/store').Writable<number[]>} */
export const mapCenter = persisted('mapCenter', defaultCenter);

/** Map zoom */
/** @type {import('svelte/store').Writable<number>} */
export const mapZoom = persisted('mapZoom', defaultZoom);

/** Default trench color hex code */
export const trenchColor = persisted('trenchColor', defaultTrenchColor);

/** Selected trench color hex code */
export const trenchColorSelected = persisted('trenchColorSelected', defaultTrenchColor);

/**
 * Light/dark mode setting.
 * @type {import('svelte/store').Writable<'light' | 'dark'>}
 */
export const lightSwitchMode = persisted('lightSwitchMode', 'light');

/** @type {import('svelte/store').Writable<string[]>} */
export const selectedFlag = persisted('selectedFlag', defaultFlagValue);

/** Whether routing mode is enabled for drawing */
export const routingMode = persisted('routingMode', false);

/** Whether to show linked trenches on map */
export const showLinkedTrenches = persisted('showLinkedTrenches', false);

/** Whether to show cable route on map */
export const showCableRoute = persisted('showCableRoute', false);

/** @type {import('svelte/store').Writable<number[]>} */
export const routingTolerance = persisted('routingTolerance', [1]);

/** @type {import('svelte/store').Writable<string | undefined>} */
export const selectedConduit = session('selectedConduit', undefined);

/** Whether the layer tree panel is expanded */
export const layerTreeExpanded = session('layerTreeExpanded', true);

/** @type {import('svelte/store').Writable<string[]>} */
export const theme = persisted('theme', ['legacy']);

/** Drawer width in pixels */
export const drawerWidth = persisted('drawerWidth', 400);

/** Whether edge snapping is enabled for drawing */
export const edgeSnappingEnabled = persisted('edgeSnappingEnabled', true);

/** Edge snapping grid size in pixels */
export const edgeSnappingGridSize = persisted('edgeSnappingGridSize', 20);

/** @type {import('svelte/store').Writable<{x: number, y: number, zoom: number}>} */
export const networkSchemaViewport = persisted('networkSchemaViewport', { x: 0, y: 0, zoom: 1 });

/** @type {import('svelte/store').Writable<{x: number, y: number, zoom: number}>} */
export const networkSchemaChildViewport = persisted('networkSchemaChildViewport', {
	x: 0,
	y: 0,
	zoom: 1
});

/** Whether to show all projects on map */
export const globalMapView = persisted('globalMapView', false);

/**
 * Cable edge color mode for network-schema diagram.
 * @type {import('svelte/store').Writable<'default' | 'linked' | 'micropipe'>}
 */
export const cableEdgeColorMode = persisted('cableEdgeColorMode', 'default');

/** Shows animated flow from start to end node on cables */
export const cableDirectionAnimationEnabled = persisted('cableDirectionAnimationEnabled', false);

export const networkSchemaPanelExpanded = persisted('networkSchemaPanelExpanded', true);
export const networkSchemaDisplayOptionsExpanded = persisted(
	'networkSchemaDisplayOptionsExpanded',
	true
);

/**
 * Node type styles - stores color, size, and visibility per node type.
 * @type {import('svelte/store').Writable<Record<string, {color: string, size: number, visible: boolean}>>}
 */
export const nodeTypeStyles = persisted('nodeTypeStyles', {});

/**
 * Address style - stores color and size for address points.
 * @type {import('svelte/store').Writable<{color: string, size: number}>}
 */
export const addressStyle = persisted('addressStyle', { color: '#2563eb', size: 4 });

/**
 * Trench styling mode - determines how trenches are colored on the map.
 * @type {import('svelte/store').Writable<'none' | 'surface' | 'construction_type'>}
 */
export const trenchStyleMode = persisted('trenchStyleMode', 'none');

/**
 * Trench surface styles - stores color and visibility per surface type.
 * @type {import('svelte/store').Writable<Record<string, {color: string, visible: boolean}>>}
 */
export const trenchSurfaceStyles = persisted('trenchSurfaceStyles', {});

/**
 * Trench construction type styles - stores color and visibility per construction type.
 * @type {import('svelte/store').Writable<Record<string, {color: string, visible: boolean}>>}
 */
export const trenchConstructionTypeStyles = persisted('trenchConstructionTypeStyles', {});

/**
 * Label visibility configuration - controls whether labels are shown on map layers.
 * @type {import('svelte/store').Writable<{trench: boolean, address: boolean, node: boolean, area: boolean, conduit: boolean}>}
 */
export const labelVisibilityConfig = persisted('labelVisibilityConfig', {
	trench: false,
	address: false,
	node: false,
	area: false,
	conduit: false
});

/**
 * Area type styles - stores color and visibility per area type.
 * @type {import('svelte/store').Writable<Record<string, {color: string, visible: boolean}>>}
 */
export const areaTypeStyles = persisted('areaTypeStyles', {});

/**
 * Layer visibility configuration - controls whether map layers are visible.
 * @type {import('svelte/store').Writable<Record<string, boolean>>}
 */
export const layerVisibilityConfig = persisted('layerVisibilityConfig', {
	'address-layer': true,
	'node-layer': true,
	'trench-layer': true,
	'area-layer': true,
	'osm-base-layer': true
});

/** Layer opacity (0-1) for the base OSM layer */
export const layerOpacity = persisted('layerOpacity', 1);

/**
 * Basemap theme - controls which map style is used.
 * @type {import('svelte/store').Writable<'light' | 'dark'>}
 */
export const basemapTheme = persisted('basemapTheme', 'light');

/** Tracks whether the vector tile server is available; falls back to OSM raster when false */
export const tileServerAvailable = persisted('tileServerAvailable', true);

/**
 * WMS layer visibility configuration - controls whether WMS layers are visible.
 * @type {import('svelte/store').Writable<Record<string, Record<string, boolean>>>}
 */
export const wmsLayerVisibilityConfig = persisted('wmsLayerVisibilityConfig', {});

/**
 * WMS source expansion state - which sources are expanded in layer tree.
 * @type {import('svelte/store').Writable<Record<string, Record<string, boolean>>>}
 */
export const wmsSourceExpansionState = persisted('wmsSourceExpansionState', {});

/** @type {import('svelte/store').Writable<{sources: import('$lib/utils/wmsApi').WMSSource[], loaded: boolean}>} */
export const wmsSourcesData = writable({ sources: [], loaded: false });

/**
 * Gets WMS layer visibility for a specific project and layer.
 * @param {Record<string, Record<string, boolean>>} config - The full visibility config store value
 * @param {string} projectId - The project ID
 * @param {string} layerId - The WMS layer ID
 * @param {boolean} [defaultValue=false] - Default visibility if not set
 * @returns {boolean} Whether the layer is visible
 */
export function getWMSLayerVisibility(config, projectId, layerId, defaultValue = false) {
	return config[projectId]?.[layerId] ?? defaultValue;
}

/**
 * Sets WMS layer visibility for a specific project and layer.
 * @param {Record<string, Record<string, boolean>>} config - The current visibility config
 * @param {string} projectId - The project ID
 * @param {string} layerId - The WMS layer ID
 * @param {boolean} visible - The visibility state
 * @returns {Record<string, Record<string, boolean>>} Updated config with new visibility
 */
export function setWMSLayerVisibility(config, projectId, layerId, visible) {
	return {
		...config,
		[projectId]: { ...config[projectId], [layerId]: visible }
	};
}

/**
 * Gets WMS source expansion state for a specific project.
 * @param {Record<string, Record<string, boolean>>} state - The full expansion state store value
 * @param {string} projectId - The project ID
 * @param {string} sourceId - The WMS source ID
 * @returns {boolean} Whether the source is expanded
 */
export function getWMSSourceExpanded(state, projectId, sourceId) {
	return state[projectId]?.[sourceId] ?? false;
}

/**
 * Sets WMS source expansion state for a specific project.
 * @param {Record<string, Record<string, boolean>>} state - The current expansion state
 * @param {string} projectId - The project ID
 * @param {string} sourceId - The WMS source ID
 * @param {boolean} expanded - The expansion state
 * @returns {Record<string, Record<string, boolean>>} Updated state with new expansion
 */
export function setWMSSourceExpanded(state, projectId, sourceId, expanded) {
	return {
		...state,
		[projectId]: { ...state[projectId], [sourceId]: expanded }
	};
}
