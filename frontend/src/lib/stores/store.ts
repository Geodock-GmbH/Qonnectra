import type { WMSSource } from '$lib/utils/wmsApi';
import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

import {
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_SELECTED_COLOR,
	DEFAULT_TRENCH_COLOR
} from '$lib/map/defaultColors';

import { persisted } from './persisted';
import { session } from './session';

/** Default center coordinates */
const defaultCenter: [number, number] = [0, 0];

/** Default zoom level */
const defaultZoom = 2;

/** Default flag value */
const defaultFlagValue = ['1'];

/** Whether the sidebar is expanded */
export const sidebarExpanded = persisted('isSidebarExpanded', true);

/** Selected project */
export const selectedProject: Writable<string> = writable('1');

/** Map center */
export const mapCenter: Writable<number[]> = persisted('mapCenter', defaultCenter);

/** Map zoom */
export const mapZoom: Writable<number> = persisted('mapZoom', defaultZoom);

/** Default trench color hex code */
export const trenchColor = persisted('trenchColor', DEFAULT_TRENCH_COLOR);

/** Selected feature highlight color hex code */
export const trenchColorSelected = persisted('trenchColorSelected', DEFAULT_SELECTED_COLOR);

/** Light/dark mode setting. */
export const lightSwitchMode: Writable<'light' | 'dark'> = persisted('lightSwitchMode', 'light');

export const selectedFlag: Writable<string[]> = persisted('selectedFlag', defaultFlagValue);

/** Whether routing mode is enabled for drawing */
export const routingMode = persisted('routingMode', false);

/** Whether to show linked trenches on map */
export const showLinkedTrenches = persisted('showLinkedTrenches', false);

/** Whether to show cable route on map */
export const showCableRoute = persisted('showCableRoute', false);

export const routingTolerance: Writable<number[]> = persisted('routingTolerance', [1]);

export const selectedConduit: Writable<string | undefined> = session('selectedConduit', undefined);

/** Whether the layer tree panel is expanded */
export const layerTreeExpanded = session('layerTreeExpanded', true);

export const theme: Writable<string[]> = persisted('theme', ['legacy']);

/** Drawer width in pixels */
export const drawerWidth = persisted('drawerWidth', 400);

export const drawerSnap: Writable<'half' | 'full'> = persisted('drawerSnap', 'half');

/** Whether edge snapping is enabled for drawing */
export const edgeSnappingEnabled = persisted('edgeSnappingEnabled', true);

/** Edge snapping grid size in pixels */
export const edgeSnappingGridSize = persisted('edgeSnappingGridSize', 20);

export const networkSchemaViewport: Writable<{ x: number; y: number; zoom: number }> = persisted(
	'networkSchemaViewport',
	{ x: 0, y: 0, zoom: 1 }
);

export const networkSchemaChildViewport: Writable<{ x: number; y: number; zoom: number }> =
	persisted('networkSchemaChildViewport', {
		x: 0,
		y: 0,
		zoom: 1
	});

/** Whether to show all projects on map */
export const globalMapView = persisted('globalMapView', false);

/** Cable edge color mode for network-schema diagram. */
export const cableEdgeColorMode: Writable<'default' | 'linked' | 'micropipe'> = persisted(
	'cableEdgeColorMode',
	'micropipe'
);

/** Shows animated flow from start to end node on cables */
export const cableDirectionAnimationEnabled = persisted('cableDirectionAnimationEnabled', false);

export const networkSchemaPanelExpanded = persisted('networkSchemaPanelExpanded', true);
export const networkSchemaDisplayOptionsExpanded = persisted(
	'networkSchemaDisplayOptionsExpanded',
	true
);

/** Node type styles - stores color, size, shape, and visibility per node type. */
export const nodeTypeStyles: Writable<
	Record<string, { color: string; size: number; visible: boolean; shape: 'circle' | 'square' }>
> = persisted('nodeTypeStyles', {});

/** Address style - stores color and size for address points. */
export const addressStyle: Writable<{ color: string; size: number }> = persisted('addressStyle', {
	color: DEFAULT_ADDRESS_COLOR,
	size: DEFAULT_ADDRESS_SIZE
});

/** Trench styling mode - determines how trenches are colored on the map. */
export const trenchStyleMode: Writable<'none' | 'surface' | 'construction_type'> = persisted(
	'trenchStyleMode',
	'none'
);

/** Trench surface styles - stores color and visibility per surface type. */
export const trenchSurfaceStyles: Writable<Record<string, { color: string; visible: boolean }>> =
	persisted('trenchSurfaceStyles', {});

/** Trench construction type styles - stores color and visibility per construction type. */
export const trenchConstructionTypeStyles: Writable<
	Record<string, { color: string; visible: boolean }>
> = persisted('trenchConstructionTypeStyles', {});

/** Label visibility configuration - controls whether labels are shown on map layers. */
export const labelVisibilityConfig: Writable<{
	trench: boolean;
	address: boolean;
	node: boolean;
	area: boolean;
	conduit: boolean;
}> = persisted('labelVisibilityConfig', {
	trench: false,
	address: false,
	node: false,
	area: false,
	conduit: false
});

/** Area type styles - stores color and visibility per area type. */
export const areaTypeStyles: Writable<Record<string, { color: string; visible: boolean }>> =
	persisted('areaTypeStyles', {});

/** Layer visibility configuration - controls whether map layers are visible. */
export const layerVisibilityConfig: Writable<Record<string, boolean>> = persisted(
	'layerVisibilityConfig',
	{
		'address-layer': true,
		'node-layer': true,
		'trench-layer': true,
		'area-layer': true,
		'osm-base-layer': true
	}
);

/** Layer opacity (0-1) for the base OSM layer */
export const layerOpacity = persisted('layerOpacity', 1);

/** Basemap theme - controls which map style is used. */
export const basemapTheme: Writable<'light' | 'dark'> = persisted('basemapTheme', 'light');

/** Tracks whether the vector tile server is available; falls back to OSM raster when false */
export const tileServerAvailable = persisted('tileServerAvailable', true);

/** WMS layer visibility configuration - controls whether WMS layers are visible. */
export const wmsLayerVisibilityConfig: Writable<Record<string, Record<string, boolean>>> =
	persisted('wmsLayerVisibilityConfig', {});

/** WMS source expansion state - which sources are expanded in layer tree. */
export const wmsSourceExpansionState: Writable<Record<string, Record<string, boolean>>> = persisted(
	'wmsSourceExpansionState',
	{}
);

export const wmsSourcesData: Writable<{ sources: WMSSource[]; loaded: boolean }> = writable({
	sources: [],
	loaded: false
});

/**
 * Gets WMS layer visibility for a specific project and layer.
 */
export function getWMSLayerVisibility(
	config: Record<string, Record<string, boolean>>,
	projectId: string,
	layerId: string,
	defaultValue = false
): boolean {
	return config[projectId]?.[layerId] ?? defaultValue;
}

/**
 * Sets WMS layer visibility for a specific project and layer.
 */
export function setWMSLayerVisibility(
	config: Record<string, Record<string, boolean>>,
	projectId: string,
	layerId: string,
	visible: boolean
): Record<string, Record<string, boolean>> {
	return {
		...config,
		[projectId]: { ...config[projectId], [layerId]: visible }
	};
}

/**
 * Gets WMS source expansion state for a specific project.
 */
export function getWMSSourceExpanded(
	state: Record<string, Record<string, boolean>>,
	projectId: string,
	sourceId: string
): boolean {
	return state[projectId]?.[sourceId] ?? false;
}

/**
 * Sets WMS source expansion state for a specific project.
 */
export function setWMSSourceExpanded(
	state: Record<string, Record<string, boolean>>,
	projectId: string,
	sourceId: string,
	expanded: boolean
): Record<string, Record<string, boolean>> {
	return {
		...state,
		[projectId]: { ...state[projectId], [sourceId]: expanded }
	};
}
