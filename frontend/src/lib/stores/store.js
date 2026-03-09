import { writable } from 'svelte/store';

import { persisted } from './persisted';
import { session } from './session';

// Default values
const defaultCenter = [0, 0];
const defaultZoom = 2;
const defaultFlagValue = ['1'];
const defaultTrenchColor = '#000000';

export const sidebarExpanded = persisted('isSidebarExpanded', true);
export const selectedProject = writable('1');
export const mapCenter = persisted('mapCenter', defaultCenter);
export const mapZoom = persisted('mapZoom', defaultZoom);
export const trenchColor = persisted('trenchColor', defaultTrenchColor);
export const trenchColorSelected = persisted('trenchColorSelected', defaultTrenchColor);
export const lightSwitchMode = persisted('lightSwitchMode', 'light');
export const selectedFlag = persisted('selectedFlag', defaultFlagValue);
export const routingMode = persisted('routingMode', false);
export const showLinkedTrenches = persisted('showLinkedTrenches', false);
export const showCableRoute = persisted('showCableRoute', false);
export const routingTolerance = persisted('routingTolerance', [1]);
export const selectedConduit = session('selectedConduit', undefined);
export const layerTreeExpanded = session('layerTreeExpanded', true);
export const theme = persisted('theme', ['legacy']);
export const drawerWidth = persisted('drawerWidth', 400);
export const edgeSnappingEnabled = persisted('edgeSnappingEnabled', true);
export const edgeSnappingGridSize = persisted('edgeSnappingGridSize', 20);
export const networkSchemaViewport = persisted('networkSchemaViewport', { x: 0, y: 0, zoom: 1 });
export const networkSchemaChildViewport = persisted('networkSchemaChildViewport', {
	x: 0,
	y: 0,
	zoom: 1
});

// Global map view - whether to show all projects on map
export const globalMapView = persisted('globalMapView', false);

// Cable edge color mode for network-schema diagram
// 'default' = static green, 'linked' = green/blue based on connection, 'micropipe' = use micropipe color
export const cableEdgeColorMode = persisted('cableEdgeColorMode', 'default');

// Cable direction animation - shows animated flow from start to end node
export const cableDirectionAnimationEnabled = persisted('cableDirectionAnimationEnabled', false);

// Network schema panel expansion states
export const networkSchemaPanelExpanded = persisted('networkSchemaPanelExpanded', true);
export const networkSchemaDisplayOptionsExpanded = persisted(
	'networkSchemaDisplayOptionsExpanded',
	true
);

// Node type styles - stores color, size, and visibility per node type
// Structure: { [node_type_name]: { color: '#hex', size: number, visible: boolean } }
export const nodeTypeStyles = persisted('nodeTypeStyles', {});

// Address style - stores color and size for address points
// Structure: { color: '#hex', size: number }
export const addressStyle = persisted('addressStyle', { color: '#2563eb', size: 4 });

// Trench styling mode - determines how trenches are colored on the map
// 'none' = single color (uses trenchColor), 'surface' = by surface type, 'construction_type' = by construction type
export const trenchStyleMode = persisted('trenchStyleMode', 'none');

// Trench surface styles - stores color and visibility per surface type
// Structure: { [surface_name]: { color: '#hex', visible: boolean } }
export const trenchSurfaceStyles = persisted('trenchSurfaceStyles', {});

// Trench construction type styles - stores color and visibility per construction type
// Structure: { [construction_type_name]: { color: '#hex', visible: boolean } }
export const trenchConstructionTypeStyles = persisted('trenchConstructionTypeStyles', {});

// Label visibility configuration - controls whether labels are shown on map layers
// Structure: { trench: boolean, address: boolean, node: boolean, area: boolean, conduit: boolean }
export const labelVisibilityConfig = persisted('labelVisibilityConfig', {
	trench: false,
	address: false,
	node: false,
	area: false,
	conduit: false
});

// Area type styles - stores color and visibility per area type
// Structure: { [area_type_name]: { color: '#hex', visible: boolean } }
export const areaTypeStyles = persisted('areaTypeStyles', {});

// Layer visibility configuration - controls whether map layers are visible
// Structure: { [layerId]: boolean }
export const layerVisibilityConfig = persisted('layerVisibilityConfig', {
	'address-layer': true,
	'node-layer': true,
	'trench-layer': true,
	'area-layer': true,
	'osm-base-layer': true
});

// Layer opacity configuration - controls the opacity of the base OSM layer
// Value: number between 0 and 1
export const layerOpacity = persisted('layerOpacity', 1);

// Basemap theme - controls which map style is used (light or dark)
// Value: 'light' | 'dark'
export const basemapTheme = persisted('basemapTheme', 'light');

// Tile server availability - tracks whether the vector tile server is available
// When false, falls back to standard OSM raster tiles
// Value: boolean
export const tileServerAvailable = persisted('tileServerAvailable', true);

// WMS layer visibility configuration - controls whether WMS layers are visible
// Structure: { [projectId]: { [layerId]: boolean } }
export const wmsLayerVisibilityConfig = persisted('wmsLayerVisibilityConfig', {});

// WMS source expansion state - which sources are expanded in layer tree
// Structure: { [projectId]: { [sourceId]: boolean } }
export const wmsSourceExpansionState = persisted('wmsSourceExpansionState', {});

// WMS sources data - populated from API
// Structure: { sources: WMSSource[], loaded: boolean }
export const wmsSourcesData = writable({ sources: [], loaded: false });

/**
 * Get WMS layer visibility for a specific project and layer
 * @param {object} config - The full visibility config store value
 * @param {string} projectId - The project ID
 * @param {string} layerId - The WMS layer ID
 * @param {boolean} [defaultValue=true] - Default visibility if not set
 * @returns {boolean}
 */
export function getWMSLayerVisibility(config, projectId, layerId, defaultValue = true) {
	return config[projectId]?.[layerId] ?? defaultValue;
}

/**
 * Set WMS layer visibility for a specific project and layer
 * @param {object} config - The current visibility config
 * @param {string} projectId - The project ID
 * @param {string} layerId - The WMS layer ID
 * @param {boolean} visible - The visibility state
 * @returns {object} Updated config
 */
export function setWMSLayerVisibility(config, projectId, layerId, visible) {
	return {
		...config,
		[projectId]: { ...config[projectId], [layerId]: visible }
	};
}

/**
 * Get WMS source expansion state for a specific project
 * @param {object} state - The full expansion state store value
 * @param {string} projectId - The project ID
 * @param {string} sourceId - The WMS source ID
 * @returns {boolean}
 */
export function getWMSSourceExpanded(state, projectId, sourceId) {
	return state[projectId]?.[sourceId] ?? false;
}

/**
 * Set WMS source expansion state for a specific project
 * @param {object} state - The current expansion state
 * @param {string} projectId - The project ID
 * @param {string} sourceId - The WMS source ID
 * @param {boolean} expanded - The expansion state
 * @returns {object} Updated state
 */
export function setWMSSourceExpanded(state, projectId, sourceId, expanded) {
	return {
		...state,
		[projectId]: { ...state[projectId], [sourceId]: expanded }
	};
}
